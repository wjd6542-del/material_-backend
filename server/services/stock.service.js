import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  async getAllList(data) {
    return prisma.stock.findMany({
      orderBy: { sort: "asc" },
    });
  },

  // 필터링 적용 리스트
  async getList(data) {
    const where = {};

    // 재고 존재 여부
    if (data.in_stock) {
      where.quantity = {
        gt: 0, // 0보다 큰 재고만
      };
    }

    // 자재 검색
    if (data.material_id) {
      where.material_id = data.material_id;
    }

    //  창고 검색
    if (data.warehouse_id) {
      where.warehouse_id = data.warehouse_id;
    }

    //  선반 검색
    if (data.location_id) {
      where.location_id = data.location_id;
    }

    // 날짜 검색
    if (data.startDate && data.endDate) {
      where.updated_at = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    // 출고 화면에서 스캔 코드 검색 들어 왔다
    if (data?.scan_code) {
      const materials = await prisma.material.findMany({
        where: {
          OR: [
            { code: { contains: data.scan_code } },
            { name: { contains: data.scan_code } },
          ],
        },
        select: {
          id: true,
        },
      });

      if (!materials.length) {
        throw new AppError("제품을 찾지못했습니다.", 404, "NOT_FOUND");
      }

      // 아이디 배열로 재고 검색 처리 해야함  material_id
      const materialIds = materials.map((m) => m.id);

      // 제품 아이디로 검색 진행
      if (materialIds.length) {
        where.material_id = {
          in: materialIds,
        };
      }
    }

    const rows = await prisma.stock.findMany({
      where,
      include: {
        material: true,
        warehouse: true,
        location: true,
      },
      orderBy: { updated_at: "asc" },
    });

    return rows.map((row) => ({
      ...row,
      material_code: row.material?.code ?? "",
      material_name: row.material?.name ?? "",
      warehouse_name: row.warehouse?.name ?? "",
      location_name: row.location?.name ?? "",
      location_code: row.location?.code ?? "",
    }));
  },

  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.stock.findUnique({ where: { id } });
    if (!item) {
      throw new AppError("존재하지 않는 편의시설입니다.", 404, "NOT_FOUND");
    }
    return item;
  },

  // 재고 변동이력 리스트
  async getDetailList(data) {
    const where = {};

    // 자재 검색
    if (data.material_id) {
      where.material_id = data.material_id;
    }

    //  창고 검색
    if (data.warehouse_id) {
      where.warehouse_id = data.warehouse_id;
    }

    //  선반 검색
    if (data.location_id) {
      where.location_id = data.location_id;
    }

    // 타입 검색
    if (data.type) {
      where.type = data.type;
    }

    // 날짜 검색
    if (data.startDate && data.endDate) {
      where.created_at = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    const rows = await prisma.stockHistory.findMany({
      where,
      include: {
        material: true,
        warehouse: true,
        location: true,
      },
      orderBy: { created_at: "asc" },
    });

    return rows.map((row) => ({
      ...row,
      material_code: row.material?.code ?? "",
      material_name: row.material?.name ?? "",
      warehouse_name: row.warehouse?.name ?? "",
      location_name: row.location?.name ?? "",
      location_code: row.location?.code ?? "",
    }));
  },

  // 창고 기준 자재 리스트
  async warehousStock() {
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

  // 선반 기준 자재 리스트
  async locationStock(data) {
    const where = {};

    if (data.warehouse_id) {
      where.warehouse_id = data.warehouse_id;
    }

    // 1️⃣ 선반 조회
    const locations = await prisma.location.findMany({
      where,
      orderBy: { sort: "asc" },
    });

    // 👉 location id 목록 추출
    const locationIds = locations.map((v) => v.id);

    // 2️⃣ 재고 groupBy (선반 기준 + 창고 필터 적용)
    const stocks = await prisma.stock.groupBy({
      by: ["location_id", "material_id"],
      where: {
        location_id: {
          in: locationIds,
        },
      },
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

    // 4️⃣ location_id 기준 map 생성
    const stockMap = {};

    stocks.forEach((v) => {
      if (!stockMap[v.location_id]) {
        stockMap[v.location_id] = [];
      }

      stockMap[v.location_id].push({
        id: v.material_id,
        material_name: materialMap[v.material_id]?.name,
        qty: v._sum.quantity,
      });
    });

    // 5️⃣ 선반 구조로 변환
    return locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      code: loc.code,
      warehouse_id: loc.warehouse_id,

      x: loc.x,
      y: loc.y,
      width: loc.width,
      height: loc.height,

      stocks: stockMap[loc.id] || [],
    }));
  },
};
