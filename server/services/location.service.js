import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  /** 위치 전체 리스트 (sort asc) */
  async getAllList(data) {
    return prisma.location.findMany({
      orderBy: { sort: "asc" },
    });
  },

  /** 위치 리스트 (warehouse_id 필터, warehouse 조인) */
  async getList(data) {
    const where = {};

    if (data?.warehouse_id) {
      where.warehouse_id = Number(data.warehouse_id);
    }

    return prisma.location.findMany({
      where,
      include: {
        warehouse: true,
      },
      orderBy: { sort: "asc" },
    });
  },

  /** 위치 단건 조회 */
  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.location.findUnique({ where: { id } });
    if (!item) {
      throw new AppError("존재하지 않는 위치 입니다.", 404, "NOT_FOUND");
    }
    return item;
  },

  /** 위치 단건 삭제 (트랜잭션으로 소속 Shelf 까지 cascade) */
  async deleteById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    await prisma.$transaction(async (tx) => {
      await tx.shelf.deleteMany({ where: { location_id: id } });
      await tx.location.delete({ where: { id } });
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
   * 위치 생성/수정 (id 없거나 0 → create, 아니면 update)
   * @param {Prisma.TransactionClient} [tx=prisma]
   */
  async save(data, tx = prisma) {
    if (!data.id || data.id === 0) {
      const createData = { ...data };
      delete createData.id;

      return tx.location.create({ data: createData });
    }

    return tx.location.update({
      where: { id: data.id },
      data,
    });
  },
};
