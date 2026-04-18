import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  /** 사업자 전체 리스트 */
  async getAllList(data) {
    return prisma.business.findMany({
      orderBy: { id: "asc" },
    });
  },

  /** 사업자 대표 정보 (첫 번째 1건) */
  async getInfo() {
    return prisma.business.findFirst({
      orderBy: { id: "asc" },
    });
  },

  /** 사업자 리스트 (필터) */
  async getList(data) {
    const where = {};
    if (data?.company_name) {
      where.company_name = { contains: data.company_name };
    }
    if (data?.registration_no) {
      where.registration_no = { contains: data.registration_no };
    }
    if (data?.ceo_name) {
      where.ceo_name = { contains: data.ceo_name };
    }

    return prisma.business.findMany({
      where,
      orderBy: { id: "asc" },
    });
  },

  /** 사업자 단건 조회 */
  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.business.findUnique({ where: { id } });
    if (!item) {
      throw new AppError("존재하지 않는 사업자입니다.", 404, "NOT_FOUND");
    }
    return item;
  },

  /** 사업자 단건 삭제 */
  async deleteById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    return prisma.business.delete({ where: { id } });
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
   * 사업자 생성/수정 (id 없거나 0 → create, 아니면 update)
   * @param {Prisma.TransactionClient} [tx=prisma]
   */
  async save(data, tx = prisma) {
    if (!data.id || data.id === 0) {
      const createData = { ...data };
      delete createData.id;

      return tx.business.create({ data: createData });
    }

    return tx.business.update({
      where: { id: data.id },
      data,
    });
  },
};
