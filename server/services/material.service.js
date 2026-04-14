import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { generateQR } from "../utils/qrcode.js";

export default {
  // 이번달 신규 자재 리스트
  async newMonthMaterial(data) {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const take = {};
    if (data?.limit) {
      take = limit;
    }

    const rows = await prisma.material.findMany({
      where: {
        created_at: {
          gte: start,
          lt: end,
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
        created_at: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return rows;
  },

  async getPageList(data) {
    const where = {};
    const page = data.page || 1;
    const limit = data.limit || 20;
    const skip = (page - 1) * limit;
    const take = limit;

    if (data.gym_id) {
      where.gym_id = Number(data.gym_id);
    }

    // 제목검색
    if (data.keyword) {
      where.title = {
        contains: data.keyword,
      };
    }

    // 날짜 검색
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
        gym: true,
        images: {
          orderBy: { sort: "asc" },
        },
      },
      skip: skip,
      take: take,
    });
  },

  // 리스트 조회
  async getList(data) {
    const where = {};

    // 갯수 제한시
    const take =
      data?.take && !isNaN(Number(data.take))
        ? Math.min(Number(data.take), 50) // 최대 50개
        : undefined;

    // 채크 검색 진행
    if (data?.material_ids && data?.material_ids.length) {
      where.id = {
        in: data.material_ids,
      };
    }

    // 카테고리 검색
    if (data?.category_id) {
      where.category_id = data.category_id;
    }

    // 키워드 검색
    if (data?.keyword) {
      where.OR = [
        {
          name: {
            contains: data.keyword,
          },
        },
        {
          memo: {
            contains: data.keyword,
          },
        },
      ];
    }

    // 날짜 검색
    if (data?.startDate && data?.endDate) {
      where.updated_at = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    //  태그 검색
    if (data?.tag_ids && data.tag_ids.length) {
      where.tags = {
        some: {
          tag_id: { in: data.tag_ids.map(Number) },
        },
      };
    }

    const rows = await prisma.material.findMany({
      where,
      orderBy: { id: "desc" },
      include: {
        category: true,
        images: {
          orderBy: { sort: "asc" },
        },
        tags: {
          include: { tag: true },
        },
      },
      take,
    });

    const result = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        category_name: row.category?.name ?? "",
        tags: row.tags.map((t) => t.tag),
        qrcode: await generateQR(row.code),
      })),
    );
    return result;
  },

  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.material.findUnique({
      where: { id },
      include: {
        category: true,
        images: {
          orderBy: { sort: "asc" },
        },
        tags: {
          include: { tag: true },
        },
      },
    });
    if (!item) {
      throw new AppError("존재하지 않는 데이터입니다.", 404, "NOT_FOUND");
    }
    return {
      ...item,
      tags: item.tags.map((t) => t.tag),
    };
  },

  async deleteById(id) {
    if (!id) {
      throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    }

    return await prisma.$transaction(async (tx) => {
      // 1️⃣ 게시물 + 이미지 조회
      const post = await tx.material.findUnique({
        where: { id },
        include: {
          images: true, // relation name 확인 필요
        },
      });

      if (!post) {
        throw new AppError("게시물을 찾을 수 없습니다.", 404, "NOT_FOUND");
      }

      const uploadDir = path.join(process.cwd(), "uploads");

      // 2️⃣ 파일 삭제
      for (const image of post.images) {
        const filePath = path.join(uploadDir, image.file_name);

        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      }

      // 3️⃣ 이미지 DB 삭제
      await tx.materialImage.deleteMany({
        where: { material_id: id },
      });

      // 4️⃣ 게시물 삭제
      await tx.material.delete({
        where: { id },
      });

      return { success: true };
    });
  },

  // 일괄 삭제
  async batchDelete(data = []) {
    if (!data.length) {
      throw new AppError("요청데이터가 없습니다.", 400, "NOT_FOUND_DATA");
    }

    const results = await Promise.all(
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
    return results;
  },

  async save(data, files = [], user) {
    const uploadDir = path.join(process.cwd(), "uploads");
    await fs.promises.mkdir(uploadDir, { recursive: true });

    const savedFiles = []; // 🔥 실제 저장된 파일 추적 (롤백용)

    try {
      const result = await prisma.$transaction(async (tx) => {
        let post;

        /* =========================
         1️⃣ 등록
      ========================== */
        const tagIds = Array.isArray(data.tag_ids) ? data.tag_ids : undefined;

        if (!data.id || data.id === 0) {
          const createData = { ...data };
          delete createData.id;
          delete createData.deleteImageIds;
          delete createData.tag_ids;

          const exist = await prisma.material.findUnique({
            where: { code: data.code },
          });

          if (exist) {
            throw new Error("이미 존재하는 자재 코드입니다.");
          }

          post = await tx.material.create({
            data: createData,
          });

          // 알림 등록처리
          await prisma.notification.create({
            data: {
              user_id: user.id,
              type: "MATERIAL",
              title: "자재 추가",
              action: "CREATE",
              message: `${data.code} 재고 정보가 등록 되었습니다.`,
              target_type: "material",
              target_id: post.id,
            },
          });
        } else {
          /* =========================
           2️⃣ 수정
        ========================== */
          const { deleteImageIds = [], tag_ids, ...updateData } = data;

          const existing = await tx.material.findUnique({
            where: { id: data.id },
          });

          if (!existing) {
            throw new Error("게시글이 존재하지 않습니다.");
          }

          post = await tx.material.update({
            where: { id: data.id },
            data: updateData,
          });

          // 알림 등록처리
          await prisma.notification.create({
            data: {
              user_id: user.id,
              type: "MATERIAL",
              title: "자재 수정",
              action: "UPDATE",
              message: `${data.code} 재고 정보가 수정 되었습니다.`,
              target_type: "material",
              target_id: post.id,
            },
          });

          /* =========================
           3️⃣ 선택 이미지 삭제
        ========================== */
          if (deleteImageIds.length > 0) {
            const imagesToDelete = await tx.materialImage.findMany({
              where: {
                id: { in: deleteImageIds },
                material_id: post.id,
              },
            });

            for (const img of imagesToDelete) {
              const filePath = path.join(
                uploadDir,
                img.file_url.replace("/uploads/", ""),
              );

              if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
              }
            }

            await tx.materialImage.deleteMany({
              where: {
                id: { in: deleteImageIds },
                material_id: post.id,
              },
            });
          }
        }

        /* =========================
         4️⃣ 신규 이미지 저장 (🔥 여기 중요)
      ========================== */
        if (files.length > 0) {
          const currentCount = await tx.materialImage.count({
            where: { material_id: post.id },
          });

          const imageRecords = [];

          for (let i = 0; i < files.length; i++) {
            const file = files[i];

            const ext = path.extname(file.filename).toLowerCase();
            const safeName = `${Date.now()}_${crypto.randomUUID()}${ext}`;

            const filePath = path.join(uploadDir, safeName);

            // 🔥 실제 파일 저장
            await fs.promises.writeFile(filePath, file.buffer);

            savedFiles.push(safeName);

            imageRecords.push({
              material_id: post.id,
              file_url: `/uploads/${safeName}`,
              file_name: safeName,
              org_name: file.originalname || file.filename,
              sort: currentCount + i,
            });
          }

          await tx.materialImage.createMany({
            data: imageRecords,
          });
        }

        /* =========================
         5️⃣ 태그 연결 동기화
      ========================== */
        if (tagIds !== undefined) {
          await tx.materialTag.deleteMany({
            where: { material_id: post.id },
          });

          if (tagIds.length) {
            await tx.materialTag.createMany({
              data: tagIds.map((tag_id) => ({
                material_id: post.id,
                tag_id: Number(tag_id),
              })),
              skipDuplicates: true,
            });
          }
        }

        return post;
      });

      return result;
    } catch (err) {
      // 🔥 DB 실패 시 파일 롤백
      for (const filename of savedFiles) {
        const filePath = path.join(uploadDir, filename);
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      }
      throw err;
    }
  },
};
