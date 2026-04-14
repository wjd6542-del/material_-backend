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

function flattenTags(row) {
  return { ...row, tags: row.tags.map((t) => t.tag) };
}

function toUploadPath(fileUrl) {
  return path.join(UPLOAD_DIR, fileUrl.replace("/uploads/", ""));
}

async function unlinkIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
}

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
  // 이번달 신규 자재 리스트
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

  // 리스트 조회
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

  // 일괄 삭제
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
