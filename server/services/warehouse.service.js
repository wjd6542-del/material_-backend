import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  async getAllList(data) {
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
      orderBy: { sort: "asc" },
    });
  },

  // 창고 기준 자재 리스트
  async materialList() {
    // 1️⃣ 랙 조회
    const racks = await prisma.warehouse.findMany({
      orderBy: { sort: "asc" },
    });

    // 2️⃣ 재고 groupBy
    const stocks = await prisma.stock.groupBy({
      by: ["warehouse_id", "material_id"],

      _sum: {
        quantity: true,
      },
    });

    // 3️⃣ 자재 정보 조회
    const materials = await prisma.material.findMany({
      where: {
        id: { in: stocks.map((v) => v.material_id) },
      },
    });

    const materialMap = Object.fromEntries(materials.map((v) => [v.id, v]));

    // 4️⃣ warehouse_id 기준 map 생성
    const stockMap = {};

    stocks.forEach((v) => {
      if (!stockMap[v.warehouse_id]) {
        stockMap[v.warehouse_id] = [];
      }

      stockMap[v.warehouse_id].push({
        id: v.material_id,
        material_name: materialMap[v.material_id]?.name,
        qty: v._sum.quantity,
      });
    });

    // 5️⃣ 랙 구조로 변환
    return racks.map((rack) => ({
      id: rack.id,
      name: rack.name,
      x: rack.x,
      y: rack.y,
      width: rack.width,
      height: rack.height,
      stocks: stockMap[rack.id] || [],
    }));
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

    // 1. 선반 삭제처리
    // 2. 창고 삭제처리
    await prisma.$transaction(async (tx) => {
      await tx.location.deleteMany({
        where: { warehouse_id: id },
      });

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

  async save(data, tx = prisma) {
    if (!data.id || data.id === 0) {
      const createData = { ...data };
      delete createData.id;

      return tx.warehouse.create({ data: createData });
    }

    return tx.warehouse.update({
      where: { id: data.id },
      data,
    });
  },
};
