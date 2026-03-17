import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  async getAllList(data) {
    return prisma.supplier.findMany({
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

    return prisma.supplier.findMany({
      where,
      orderBy: { sort: "asc" },
    });
  },

  async getKeyGroup() {
    const res = await prisma.supplier.groupBy({
      by: ["key"],
    });
    return res;
  },

  // 필터링 적용 리스트
  async getViewList(data) {
    const where = {};
    if (data?.key) {
      where.key = data.key;
    }

    return prisma.supplier.findMany({
      where,
      orderBy: { sort: "asc" },
      select: {
        id: true,
        text: true,
        value: true,
      },
    });
  },

  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.supplier.findUnique({ where: { id } });
    if (!item) {
      throw new AppError("존재하지 않는 편의시설입니다.", 404, "NOT_FOUND");
    }
    return item;
  },

  async deleteById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    return prisma.supplier.delete({ where: { id } });
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

      return tx.supplier.create({ data: createData });
    }

    return tx.supplier.update({
      where: { id: data.id },
      data,
    });
  },
};
