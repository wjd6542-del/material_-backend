import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  async getAllList(data) {
    return prisma.role.findMany({
      orderBy: { sort: "asc" },
    });
  },

  // 필터링 적용 리스트
  async getList(data) {
    const where = {};
    if (data?.key) {
      where.key = data.key;
    }

    // 키 배열 검색
    if (data?.keys?.length) {
      where.key = {
        in: data.keys,
      };
    }

    return prisma.role.findMany({
      where,
      include: {
        permissions: true,
      },
      orderBy: { sort: "asc" },
    });
  },

  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: true,
      },
    });
    if (!item) {
      throw new AppError("존재하지 않는 편의시설입니다.", 404, "NOT_FOUND");
    }
    return item;
  },

  async deleteById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    return prisma.role.delete({ where: { id } });
  },

  /**
   * 일괄 삭제
   * @param {*} data
   */
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

  /**
   * 일괄 저장
   * @param {*} data
   */
  async batchSave(data = []) {
    if (!data.length) {
      throw new AppError("요청데이터가 없습니다.", 400, "NOT_FOUND_DATA");
    }

    const results = await Promise.all(
      data.map((row, idx) =>
        this.save(row).catch(() => {
          throw new AppError(
            `${idx + 1}번째 데이터 저장 실패`,
            400,
            "BATCH_SAVE_FAILED",
          );
        }),
      ),
    );

    return results;
  },

  async save(data, tx = prisma) {
    if (!data.id || data.id === 0) {
      const createData = { ...data };
      delete createData.id;

      return tx.role.create({ data: createData });
    }

    return tx.role.update({
      where: { id: data.id },
      data,
    });
  },

  // 메뉴 권한 적용처리
  async permissionSave(data) {
    const { role_id, permission_ids } = data;

    return await prisma.$transaction(async (tx) => {
      // 1. 기존 전부 삭제
      await tx.rolePermission.deleteMany({
        where: { role_id },
      });

      // 2. 최신 권한만 다시 생성
      if (permission_ids.length) {
        await tx.rolePermission.createMany({
          data: permission_ids.map((permission_id) => ({
            role_id,
            permission_id,
          })),
        });
      }

      return true;
    });
  },
};
