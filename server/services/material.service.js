import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { generateQR } from "../utils/qrcode.js";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MATERIAL_INCLUDE = {
  category: true,
  images: { orderBy: { sort: "asc" } },
  tags: { include: { tag: true } },
};

/** MaterialTag 중간 테이블을 풀어서 tags 배열을 평탄화한다. */
function flattenTags(row) {
  return { ...row, tags: row.tags.map((t) => t.tag) };
}

/** `/uploads/xxx` 공개 URL → 실제 파일 시스템 경로로 변환. */
function toUploadPath(fileUrl) {
  return path.join(UPLOAD_DIR, fileUrl.replace("/uploads/", ""));
}

/** 파일이 존재하면 삭제 (없어도 에러 없이 통과). */
async function unlinkIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
}

/**
 * 자재-태그 매핑 동기화 (기존 매핑 전부 삭제 후 tagIds 로 재생성)
 * @param {Prisma.TransactionClient} tx
 * @param {number} materialId
 * @param {number[]} tagIds
 */
async function syncMaterialTags(tx, materialId, tagIds) {
  await tx.materialTag.deleteMany({ where: { material_id: materialId } });
  if (!tagIds.length) return;
  await tx.materialTag.createMany({
    data: tagIds.map((tag_id) => ({
      material_id: materialId,
      tag_id: Number(tag_id),
    })),
    skipDuplicates: true,
  });
}

/** 자재 생성/수정 시 MATERIAL 타입 알림 생성 */
async function createNotification(tx, user, post, isCreate) {
  await tx.notification.create({
    data: {
      user_id: user.id,
      type: "MATERIAL",
      title: isCreate ? "자재 추가" : "자재 수정",
      action: isCreate ? "CREATE" : "UPDATE",
      message: `${post.code} 재고 정보가 ${isCreate ? "등록" : "수정"} 되었습니다.`,
      target_type: "material",
      target_id: post.id,
    },
  });
}

/**
 * 업로드된 이미지들을 디스크에 저장하고 MaterialImage 레코드 생성.
 * @param {Prisma.TransactionClient} tx
 * @param {number} materialId
 * @param {Array} files parseMultipart 결과 files 배열
 * @param {string[]} savedFiles 롤백용 파일명 누적 배열 (out-param)
 */
async function saveImageFiles(tx, materialId, files, savedFiles) {
  if (!files.length) return;

  const currentCount = await tx.materialImage.count({
    where: { material_id: materialId },
  });

  const imageRecords = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = path.extname(file.filename).toLowerCase();
    const safeName = `${Date.now()}_${crypto.randomUUID()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, safeName);

    await fs.promises.writeFile(filePath, file.buffer);
    savedFiles.push(safeName);

    imageRecords.push({
      material_id: materialId,
      file_url: `/uploads/${safeName}`,
      file_name: safeName,
      org_name: file.originalname || file.filename,
      sort: currentCount + i,
    });
  }

  await tx.materialImage.createMany({ data: imageRecords });
}

/**
 * 지정된 MaterialImage ID 목록을 디스크 + DB 에서 삭제.
 * @param {Prisma.TransactionClient} tx
 * @param {number} materialId
 * @param {number[]} deleteImageIds
 */
async function deleteSelectedImages(tx, materialId, deleteImageIds) {
  if (!deleteImageIds.length) return;

  const imagesToDelete = await tx.materialImage.findMany({
    where: { id: { in: deleteImageIds }, material_id: materialId },
  });

  for (const img of imagesToDelete) {
    await unlinkIfExists(toUploadPath(img.file_url));
  }

  await tx.materialImage.deleteMany({
    where: { id: { in: deleteImageIds }, material_id: materialId },
  });
}

export default {
  /**
   * 이번 달 1일 00:00 ~ 다음 달 1일 범위로 생성된 자재 리스트 (대시보드용)
   * @param {{limit?:number}} data
   * @returns {Promise<Array<{id:number,name:string,code:string,created_at:Date}>>}
   */
  async newMonthMaterial(data) {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const take =
      data?.limit && !isNaN(Number(data.limit))
        ? Number(data.limit)
        : undefined;

    return prisma.material.findMany({
      where: { created_at: { gte: start, lt: end } },
      select: { id: true, name: true, code: true, created_at: true },
      orderBy: { created_at: "desc" },
      take,
    });
  },

  /**
   * 자재 페이지네이션 리스트 (page/limit/keyword/기간 필터)
   * @param {{page?:number,limit?:number,keyword?:string,startDate?:string,endDate?:string}} data
   */
  async getPageList(data) {
    const where = {};
    const page = data.page || 1;
    const limit = data.limit || 20;
    const skip = (page - 1) * limit;

    if (data.keyword) {
      where.name = { contains: data.keyword };
    }

    if (data.startDate && data.endDate) {
      where.created_at = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    return prisma.material.findMany({
      where,
      orderBy: { id: "desc" },
      include: {
        images: { orderBy: { sort: "asc" } },
      },
      skip,
      take: limit,
    });
  },

  /**
   * 자재 리스트 (material_ids/category/keyword/tag/기간 필터, 최대 50건, QR 포함)
   * @param {Object} data
   * @returns {Promise<Array>}
   */
  async getList(data) {
    const where = {};

    const take =
      data?.take && !isNaN(Number(data.take))
        ? Math.min(Number(data.take), 50)
        : undefined;

    if (data?.material_ids?.length) {
      where.id = { in: data.material_ids };
    }

    if (data?.category_id) {
      where.category_id = data.category_id;
    }

    if (data?.keyword) {
      where.OR = [
        { name: { contains: data.keyword } },
        { memo: { contains: data.keyword } },
      ];
    }

    if (data?.startDate && data?.endDate) {
      where.updated_at = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    if (data?.tag_ids?.length) {
      where.tags = {
        some: { tag_id: { in: data.tag_ids.map(Number) } },
      };
    }

    const rows = await prisma.material.findMany({
      where,
      orderBy: { id: "desc" },
      include: MATERIAL_INCLUDE,
      take,
    });

    return Promise.all(
      rows.map(async (row) => ({
        ...flattenTags(row),
        category_name: row.category?.name ?? "",
        qrcode: await generateQR(row.code),
      })),
    );
  },

  /**
   * 자재 단건 조회 (category/images/tags 포함)
   * @param {number} id
   */
  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.material.findUnique({
      where: { id },
      include: MATERIAL_INCLUDE,
    });
    if (!item) {
      throw new AppError("존재하지 않는 데이터입니다.", 404, "NOT_FOUND");
    }
    return flattenTags(item);
  },

  /**
   * 자재 단건 삭제 (이미지 파일 디스크 + MaterialImage + Material 순서로 삭제)
   * @param {number} id
   */
  async deleteById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    return prisma.$transaction(async (tx) => {
      const post = await tx.material.findUnique({
        where: { id },
        include: { images: true },
      });

      if (!post) {
        throw new AppError("게시물을 찾을 수 없습니다.", 404, "NOT_FOUND");
      }

      for (const image of post.images) {
        await unlinkIfExists(path.join(UPLOAD_DIR, image.file_name));
      }

      await tx.materialImage.deleteMany({ where: { material_id: id } });
      await tx.material.delete({ where: { id } });

      return { success: true };
    });
  },

  /**
   * 자재 일괄 삭제 (Promise.all + deleteById 각 건 실행, 실패 건 인덱스 포함 에러)
   * @param {Array<{id:number}>} data
   */
  async batchDelete(data = []) {
    if (!data.length) {
      throw new AppError("요청데이터가 없습니다.", 400, "NOT_FOUND_DATA");
    }

    return Promise.all(
      data.map((row, idx) =>
        this.deleteById(row.id).catch(() => {
          throw new AppError(
            `${idx + 1} 번째 데이터 삭제 실패`,
            400,
            "BATCH_DELETE_FAILED",
          );
        }),
      ),
    );
  },

  /**
   * 자재 생성/수정 트랜잭션
   * - id 없으면 생성(code 중복 체크), 있으면 수정 + deleteImageIds 처리
   * - 알림 생성, 이미지 파일 저장, 태그 재동기화 모두 트랜잭션 내 수행
   * - 트랜잭션 실패 시 이미 디스크에 저장된 이미지 파일 롤백
   * @param {Object} data { id, code, name, ..., deleteImageIds, tag_ids }
   * @param {Array} files 업로드 파일 배열
   * @param {Object} user 로그인 사용자
   */
  async save(data, files = [], user) {
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });

    const savedFiles = [];
    const { id, deleteImageIds = [], tag_ids, ...fields } = data;
    const tagIds = Array.isArray(tag_ids) ? tag_ids : undefined;
    const isCreate = !id || id === 0;

    try {
      return await prisma.$transaction(async (tx) => {
        let post;

        if (isCreate) {
          const exist = await tx.material.findUnique({
            where: { code: fields.code },
          });
          if (exist) {
            throw new Error("이미 존재하는 자재 코드입니다.");
          }

          post = await tx.material.create({ data: fields });
        } else {
          const existing = await tx.material.findUnique({ where: { id } });
          if (!existing) {
            throw new Error("게시글이 존재하지 않습니다.");
          }

          post = await tx.material.update({
            where: { id },
            data: fields,
          });

          await deleteSelectedImages(tx, post.id, deleteImageIds);
        }

        await createNotification(tx, user, post, isCreate);
        await saveImageFiles(tx, post.id, files, savedFiles);

        if (tagIds !== undefined) {
          await syncMaterialTags(tx, post.id, tagIds);
        }

        return post;
      });
    } catch (err) {
      // DB 실패 시 파일 롤백
      for (const filename of savedFiles) {
        await unlinkIfExists(path.join(UPLOAD_DIR, filename));
      }
      throw err;
    }
  },
};
