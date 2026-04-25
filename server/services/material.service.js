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

/** 이력으로 추적하는 가격·비율 컬럼 목록 (변경 감지 및 스냅샷 저장 대상) */
const PRICE_FIELDS = [
  // 가격 6종
  "inbound_price",
  "outbound_price1",
  "outbound_price2",
  "wholesale_price1",
  "wholesale_price2",
  "online_price",
  // 비율 5종 (구매는 기준값이라 제외)
  "outbound_rate1",
  "outbound_rate2",
  "wholesale_rate1",
  "wholesale_rate2",
  "online_rate",
];

/**
 * 객체에서 가격 6종만 추출해 숫자로 정규화 (Decimal → Number, null/undefined → 0)
 * @param {Record<string, any>} obj
 * @returns {Record<string, number>}
 */
function pickPrices(obj) {
  const out = {};
  for (const k of PRICE_FIELDS) {
    out[k] = Number(obj?.[k] ?? 0);
  }
  return out;
}

/** 두 가격 스냅샷 비교 (정규화된 number 비교) */
function pricesDiffer(before, after) {
  return PRICE_FIELDS.some((k) => before[k] !== after[k]);
}

/**
 * MaterialPriceHistory 1행 기록 (트랜잭션 내 호출)
 * @param {Prisma.TransactionClient} tx
 * @param {number} materialId
 * @param {Record<string, number>} prices
 * @param {"CREATE"|"UPDATE"} action
 * @param {number|null} changedBy
 * @param {string|null} [reason]
 */
async function insertPriceHistory(tx, materialId, prices, action, changedBy, reason = null) {
  await tx.materialPriceHistory.create({
    data: {
      material_id: materialId,
      ...prices,
      action,
      changed_by: changedBy,
      reason,
    },
  });
}

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
 * 품목-태그 매핑 동기화 (기존 매핑 전부 삭제 후 tagIds 로 재생성)
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

/** 품목 생성/수정 시 MATERIAL 타입 알림 생성 */
async function createNotification(tx, user, post, isCreate) {
  await tx.notification.create({
    data: {
      user_id: user.id,
      type: "MATERIAL",
      title: isCreate ? "품목 추가" : "품목 수정",
      action: isCreate ? "CREATE" : "UPDATE",
      message: `${post.code} 재고 정보가 ${isCreate ? "등록" : "수정"} 되었습니다.`,
      target_type: "material",
      target_id: post.id,
    },
  });
}

/**
 * 업로드 파일을 디스크에 먼저 쓰고(트랜잭션 밖) 나중에 DB 에 createMany 할
 * 준비 레코드 배열을 만들어 반환한다. 트랜잭션 내부에서 파일 쓰기를 하면
 * 이후 DB 단계 실패 시 이미 쓴 파일이 남거나, 삭제 파일이 돌아오지 않는
 * DB-디스크 불일치가 발생하므로 쓰기는 무조건 tx 전에 선행한다.
 * 중간 실패 시 지금까지 쓴 파일은 호출자에서 일괄 삭제해야 한다.
 * @param {Array} files parseMultipart 결과 files 배열
 * @returns {Promise<Array<{safeName:string, originalname:string}>>}
 */
async function writeUploadsToDisk(files) {
  const prepared = [];
  try {
    for (const file of files) {
      const ext = path.extname(file.filename).toLowerCase();
      const safeName = `${Date.now()}_${crypto.randomUUID()}${ext}`;
      const filePath = path.join(UPLOAD_DIR, safeName);
      await fs.promises.writeFile(filePath, file.buffer);
      prepared.push({
        safeName,
        originalname: file.originalname || file.filename,
      });
    }
    return prepared;
  } catch (err) {
    // 중간 실패: 지금까지 쓴 파일은 즉시 정리
    for (const p of prepared) {
      await unlinkIfExists(path.join(UPLOAD_DIR, p.safeName));
    }
    throw err;
  }
}

/**
 * 디스크에 이미 쓰여진 파일 정보를 토대로 MaterialImage 레코드를 일괄 생성.
 * 트랜잭션 내부 DB 전용 연산.
 */
async function insertImageRecords(tx, materialId, prepared) {
  if (!prepared.length) return;
  const currentCount = await tx.materialImage.count({
    where: { material_id: materialId },
  });
  await tx.materialImage.createMany({
    data: prepared.map((p, i) => ({
      material_id: materialId,
      file_url: `/uploads/${p.safeName}`,
      file_name: p.safeName,
      org_name: p.originalname,
      sort: currentCount + i,
    })),
  });
}

/**
 * 지정된 MaterialImage ID 목록을 DB 에서만 삭제하고, 디스크 파일 경로는
 * 반환만 한다(호출자가 커밋 후 삭제). 트랜잭션 내부에서 디스크 unlink 를
 * 하면 이후 tx 단계 실패 시 파일은 돌아오지 않으므로 분리 필수.
 */
async function removeImageRecordsAndCollectPaths(tx, materialId, deleteImageIds) {
  if (!deleteImageIds.length) return [];

  const imagesToDelete = await tx.materialImage.findMany({
    where: { id: { in: deleteImageIds }, material_id: materialId },
  });

  await tx.materialImage.deleteMany({
    where: { id: { in: deleteImageIds }, material_id: materialId },
  });

  return imagesToDelete.map((img) => toUploadPath(img.file_url));
}

export default {
  /**
   * 이번 달 1일 00:00 ~ 다음 달 1일 범위로 생성된 품목 리스트 (대시보드용)
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
   * 품목 가격 이력 리스트 (역방향 페이지네이션, changed_by 이름 포함)
   * @param {{material_id:number, beforeId?:number, limit?:number}} data
   * @returns {Promise<Array<{...MaterialPriceHistory, changed_by_name:string}>>}
   */
  async getPriceHistory(data) {
    const materialId = Number(data?.material_id);
    if (!materialId) {
      throw new AppError("material_id 가 필요합니다.", 400, "INVALID_ID");
    }

    const limit = Math.min(Math.max(Number(data?.limit) || 50, 1), 200);
    const beforeId = data?.beforeId ? Number(data.beforeId) : undefined;

    const rows = await prisma.materialPriceHistory.findMany({
      where: {
        material_id: materialId,
        ...(beforeId ? { id: { lt: beforeId } } : {}),
      },
      orderBy: { id: "desc" },
      take: limit,
    });

    const userIds = [...new Set(rows.map((r) => r.changed_by).filter((v) => v != null))];

    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, username: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return rows.map((r) => ({
      ...r,
      changed_by_name: userMap.get(r.changed_by)?.name ?? "",
      changed_by_username: userMap.get(r.changed_by)?.username ?? "",
    }));
  },

  /**
   * 품목 페이지네이션 리스트 (page/limit/keyword/기간 필터)
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
   * 품목 리스트 (material_ids/category/keyword/tag/기간 필터, 최대 50건, QR 포함)
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
   * 품목 단건 조회 (category/images/tags 포함)
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
   * 품목 단건 삭제 (이미지 파일 디스크 + MaterialImage + Material 순서로 삭제)
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
   * 품목 일괄 삭제 (Promise.all + deleteById 각 건 실행, 실패 건 인덱스 포함 에러)
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
   * 품목 생성/수정 트랜잭션
   * - id 없으면 생성(code 중복 체크), 있으면 수정 + deleteImageIds 처리
   * - 디스크 I/O 와 DB 트랜잭션을 분리해 불일치를 방지한다:
   *   1) 신규 업로드는 tx 전에 디스크 기록 → tx 실패 시 cleanup
   *   2) 삭제 대상은 tx 내부에서 DB row 만 제거하고 파일 경로 수집 →
   *      커밋 성공 후 디스크 unlink (unlink 실패해도 DB 는 이미 일관)
   * @param {Object} data { id, code, name, ..., deleteImageIds, tag_ids }
   * @param {Array} files 업로드 파일 배열
   * @param {Object} user 로그인 사용자
   */
  async save(data, files = [], user) {
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });

    const { id, deleteImageIds = [], tag_ids, ...fields } = data;
    const tagIds = Array.isArray(tag_ids) ? tag_ids : undefined;
    const isCreate = !id || id === 0;

    // 1) 트랜잭션 전에 업로드 파일을 디스크에 선기록
    const prepared = await writeUploadsToDisk(files);

    let post;
    let filesToUnlinkAfterCommit = [];
    try {
      post = await prisma.$transaction(async (tx) => {
        let innerPost;
        let oldPrices = null;

        if (isCreate) {
          const exist = await tx.material.findUnique({
            where: { code: fields.code },
          });
          if (exist) {
            throw new Error("이미 존재하는 품목 코드입니다.");
          }

          innerPost = await tx.material.create({ data: fields });
        } else {
          const existing = await tx.material.findUnique({ where: { id } });
          if (!existing) {
            throw new Error("게시글이 존재하지 않습니다.");
          }

          oldPrices = pickPrices(existing);

          innerPost = await tx.material.update({
            where: { id },
            data: fields,
          });

          // DB row 만 삭제하고 디스크 파일 경로는 커밋 후 삭제용으로 수집
          filesToUnlinkAfterCommit = await removeImageRecordsAndCollectPaths(
            tx,
            innerPost.id,
            deleteImageIds,
          );
        }

        await createNotification(tx, user, innerPost, isCreate);
        await insertImageRecords(tx, innerPost.id, prepared);

        if (tagIds !== undefined) {
          await syncMaterialTags(tx, innerPost.id, tagIds);
        }

        // 가격 이력 기록
        // - CREATE: 항상 스냅샷 1행 저장
        // - UPDATE: 6개 가격 중 하나라도 변경됐을 때만 저장
        const newPrices = pickPrices(innerPost);
        if (isCreate) {
          await insertPriceHistory(tx, innerPost.id, newPrices, "CREATE", user?.id ?? null);
        } else if (pricesDiffer(oldPrices, newPrices)) {
          await insertPriceHistory(tx, innerPost.id, newPrices, "UPDATE", user?.id ?? null);
        }

        return innerPost;
      });
    } catch (err) {
      // 트랜잭션 실패 → 선기록한 업로드 파일 정리 (삭제 대상은 아직 디스크에 있으므로 건드리지 않음)
      for (const p of prepared) {
        await unlinkIfExists(path.join(UPLOAD_DIR, p.safeName));
      }
      throw err;
    }

    // 2) 커밋 성공 후 삭제 대상 디스크 파일 정리
    //    unlink 실패 시에도 DB 는 이미 일관 — 로그만 남기고 진행 (orphan 은 별도 스윕 대상)
    for (const fp of filesToUnlinkAfterCommit) {
      try {
        await unlinkIfExists(fp);
      } catch (e) {
        console.error("[material.save] orphan file unlink failed:", fp, e);
      }
    }

    return post;
  },
};
