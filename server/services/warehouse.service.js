import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  /** 창고 전체 리스트 (sort asc) — 기본 활성만 */
  async getAllList(data) {
    const where = {};
    if (!data?.includeInactive) where.is_active = true;
    return prisma.warehouse.findMany({
      where,
      orderBy: { sort: "asc" },
    });
  },

  /** 창고 리스트 (key/keys 필터, locations/stocks 포함) */
  async getList(data) {
    const where = {};
    if (!data?.includeInactive) where.is_active = true;
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

  /** 창고 활성/비활성 토글 */
  async setActive(data, user) {
    if (!data?.id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    if (typeof data.is_active !== "boolean") {
      throw new AppError("is_active 값이 필요합니다.", 400, "INVALID_PARAMS");
    }
    return prisma.warehouse.update({
      where: { id: Number(data.id) },
      data: { is_active: data.is_active },
    });
  },

  /** 창고 단건 조회 */
  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.warehouse.findUnique({ where: { id } });
    if (!item) {
      throw new AppError("존재하지 않는 창고 입니다.", 404, "NOT_FOUND");
    }
    return item;
  },

  /**
   * 창고 삭제 (트랜잭션)
   * 1) 창고 소속 Location 의 Shelf 삭제
   * 2) Location 삭제
   * 3) Warehouse 삭제
   */
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

  /**
   * 창고 생성/수정 (id 없거나 0 이면 create, 아니면 update)
   */
  async save(data) {
    const { id, ...saveData } = data;

    if (!id || id === 0) {
      return prisma.warehouse.create({ data: saveData });
    }

    return prisma.warehouse.update({ where: { id }, data: saveData });
  },
};
