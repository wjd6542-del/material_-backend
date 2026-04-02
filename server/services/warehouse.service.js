import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  async getAllList() {
    return prisma.warehouse.findMany({
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

    return prisma.warehouse.findMany({
      where,
      include: {
        locations: true,
        stocks: true,
      },
      orderBy: { sort: "asc" },
    });
  },

  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.warehouse.findUnique({ where: { id } });
    if (!item) {
      throw new AppError("존재하지 않는 편의시설입니다.", 404, "NOT_FOUND");
    }
    return item;
  },

  // 삭제처리
  async deleteById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    await prisma.$transaction(async (tx) => {
      // 1. 해당 창고의 위치 ID 목록 조회
      const locations = await tx.location.findMany({
        where: { warehouse_id: id },
        select: { id: true },
      });
      const locationIds = locations.map((l) => l.id);

      // 2. 선반 삭제
      if (locationIds.length) {
        await tx.shelf.deleteMany({
          where: { location_id: { in: locationIds } },
        });
      }

      // 3. 위치 삭제
      await tx.location.deleteMany({
        where: { warehouse_id: id },
      });

      // 4. 창고 삭제
      await tx.warehouse.delete({
        where: { id },
      });
    });

    return true;
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

  async save(data) {
    const { id, ...saveData } = data;

    if (!id || id === 0) {
      return prisma.warehouse.create({ data: saveData });
    }

    return prisma.warehouse.update({ where: { id }, data: saveData });
  },
};
