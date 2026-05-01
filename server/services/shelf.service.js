import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  /** 선반 전체 리스트 — 기본 활성만 */
  async getAllList(data) {
    const where = {};
    if (!data?.includeInactive) where.is_active = true;
    return prisma.shelf.findMany({
      where,
      orderBy: { sort: "asc" },
    });
  },

  /** 선반 리스트 (location_id 필터, location 조인) */
  async getList(data) {
    const where = {};
    if (!data?.includeInactive) where.is_active = true;

    if (data?.location_id) {
      where.location_id = Number(data.location_id);
    }

    return prisma.shelf.findMany({
      where,
      include: {
        location: true,
      },
      orderBy: { sort: "asc" },
    });
  },

  /** 선반 활성/비활성 토글 */
  async setActive(data, user) {
    if (!data?.id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    if (typeof data.is_active !== "boolean") {
      throw new AppError("is_active 값이 필요합니다.", 400, "INVALID_PARAMS");
    }
    return prisma.shelf.update({
      where: { id: Number(data.id) },
      data: { is_active: data.is_active },
    });
  },

  /** 선반 단건 조회 */
  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.shelf.findUnique({ where: { id } });
    if (!item) {
      throw new AppError("존재하지 않는 선반입니다.", 404, "NOT_FOUND");
    }
    return item;
  },

  /** 선반 단건 삭제 */
  async deleteById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    return prisma.shelf.delete({ where: { id } });
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
   * 선반 생성/수정 (id 없거나 0 → create, 아니면 update)
   * @param {Prisma.TransactionClient} [tx=prisma]
   */
  async save(data, tx = prisma) {
    if (!data.id || data.id === 0) {
      const createData = { ...data };
      delete createData.id;

      return tx.shelf.create({ data: createData });
    }

    return tx.shelf.update({
      where: { id: data.id },
      data,
    });
  },
};
