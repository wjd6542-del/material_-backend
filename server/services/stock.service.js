import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { generateQR } from "../utils/qrcode.js";

export default {
  // 총재고 수량
  async stockSummary(data) {
    const count = await prisma.stock.count();

    const qty = await prisma.stock.aggregate({
      _sum: {
        quantity: true,
      },
    });

    return {
      count: count,
      total_qty: qty._sum.quantity,
    };
  },

  // 안전재고 미만
  async getLowStockMaterials(data) {
    const limit = data?.limit ?? 10;

    const grouped = await prisma.stock.groupBy({
      by: ["material_id"],
      _sum: {
        quantity: true,
      },
    });

    const materials = await prisma.material.findMany({
      select: {
        id: true,
        name: true,
        safety_stock: true,
      },
    });

    const result = materials
      .map((m) => {
        const stock = grouped.find((g) => g.material_id === m.id);

        const qty = stock?._sum.quantity || 0;

        return {
          id: m.id,
          name: m.name,
          safe_qty: m.safety_stock,
          qty,
        };
      })
      .filter((row) => row.qty < row.safe_qty) // ✅ 수정
      .sort((a, b) => a.qty - b.qty)
      .slice(0, limit);
    return result;
  },

  async getAllList(data) {
    return prisma.stock.findMany({
      orderBy: { sort: "asc" },
    });
  },

  // 필터링 적용 리스트
  async getList(data) {
    const where = {};

    // 재고 존재 여부
    if (data?.in_stock) {
      where.quantity = {
        gt: 0, // 0보다 큰 재고만
      };
    }

    // 자재 검색
    if (data?.material_id) {
      where.material_id = data.material_id;
    }

    //  창고 검색
    if (data?.warehouse_id) {
      where.warehouse_id = data.warehouse_id;
    }

    //  선반 검색
    if (data?.location_id) {
      where.location_id = data.location_id;
    }

    // 날짜 검색
    if (data?.startDate && data?.endDate) {
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
      orderBy: { updated_at: "desc" },
    });

    const result = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        qrcode: await generateQR(row.material?.code),
        material_code: row.material?.code ?? "",
        material_name: row.material?.name ?? "",
        warehouse_name: row.warehouse?.name ?? "",
        location_name: row.location?.name ?? "",
        location_code: row.location?.code ?? "",
      })),
    );

    return result;
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
      orderBy: { created_at: "desc" },
    });

    const result = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        qrcode: await generateQR(row.material?.code),
        material_code: row.material?.code ?? "",
        material_name: row.material?.name ?? "",
        warehouse_name: row.warehouse?.name ?? "",
        location_name: row.location?.name ?? "",
        location_code: row.location?.code ?? "",
      })),
    );

    return result;
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

    const locationIds = locations.map((v) => v.id);

    // 2️⃣ 재고 groupBy
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

    const materialIds = stocks.map((v) => v.material_id);

    // 3️⃣ 자재 + 이미지 조회 (🔥 여기 수정)
    const materials = await prisma.material.findMany({
      where: {
        id: { in: materialIds },
      },
      select: {
        id: true,
        name: true,
        images: {
          select: {
            id: true,
            file_url: true,
            file_name: true,
          },
          orderBy: {
            sort: "asc",
          },
          take: 1, // 대표 이미지 1개
        },
      },
    });

    const materialMap = Object.fromEntries(materials.map((v) => [v.id, v]));

    // 4️⃣ stock map
    const stockMap = {};

    stocks.forEach((v) => {
      if (!stockMap[v.location_id]) {
        stockMap[v.location_id] = [];
      }

      const material = materialMap[v.material_id];
      const image = material?.images?.[0];

      stockMap[v.location_id].push({
        id: v.material_id,
        material_name: material?.name,
        qty: v._sum.quantity,

        // ✅ 실제 필드 기준
        image: image || null,
        image_url: image?.file_url || null,
      });
    });

    // 5️⃣ 반환
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

  // 재고 이동 처리
  // 재고 이동 처리
  async transfer(data, user) {
    const { material_id, from_location_id, to_location_id, quantity } = data;

    if (!material_id) throw new Error("자재 없음");
    if (!from_location_id) throw new Error("출발 위치 없음");
    if (!to_location_id) throw new Error("도착 위치 없음");
    if (from_location_id === to_location_id) {
      throw new Error("같은 위치 이동 불가");
    }
    if (quantity <= 0) throw new Error("수량 오류");

    return await prisma.$transaction(async (tx) => {
      // 🔥 0. location → warehouse 추출
      const [fromLocation, toLocation] = await Promise.all([
        tx.location.findUnique({ where: { id: from_location_id } }),
        tx.location.findUnique({ where: { id: to_location_id } }),
      ]);

      if (!fromLocation || !toLocation) {
        throw new Error("위치 정보 없음");
      }

      const fromWarehouseId = fromLocation.warehouse_id;
      const toWarehouseId = toLocation.warehouse_id;

      // 🔥 1. 출발 재고 조회
      const fromStock = await tx.stock.findUnique({
        where: {
          material_id_warehouse_id_location_id: {
            material_id,
            warehouse_id: fromWarehouseId,
            location_id: from_location_id,
          },
        },
        include: {
          material: true,
          location: true,
        },
      });

      if (!fromStock) {
        throw new Error("출발 재고 없음");
      }

      if (fromStock.quantity < quantity) {
        throw new Error("재고 부족");
      }

      const fromBefore = fromStock.quantity;

      // 🔥 2. 출발지 차감
      await tx.stock.update({
        where: { id: fromStock.id },
        data: {
          quantity: { decrement: quantity },
        },
      });

      // 🔥 3. 도착 재고 조회
      const toStock = await tx.stock.findUnique({
        where: {
          material_id_warehouse_id_location_id: {
            material_id,
            warehouse_id: toWarehouseId,
            location_id: to_location_id,
          },
        },
        include: {
          location: true,
        },
      });

      let toBefore = 0;
      let toStockId = null;

      // 🔥 4. 도착지 증가 or 생성
      if (toStock) {
        toBefore = toStock.quantity;
        toStockId = toStock.id;

        await tx.stock.update({
          where: { id: toStock.id },
          data: {
            quantity: { increment: quantity },
          },
        });
      } else {
        const created = await tx.stock.create({
          data: {
            material_id,
            warehouse_id: toWarehouseId,
            location_id: to_location_id,
            quantity,
          },
        });

        toStockId = created.id;
      }

      // 🔥 5. 이력 기록 (OUT)
      await tx.stockHistory.create({
        data: {
          material_id,
          warehouse_id: fromWarehouseId,
          location_id: from_location_id,
          stock_id: fromStock.id,
          type: "TRANSFER_OUT",
          quantity,
          before_qty: fromBefore,
          after_qty: fromBefore - quantity,
        },
      });

      // 🔥 6. 이력 기록 (IN)
      await tx.stockHistory.create({
        data: {
          material_id,
          warehouse_id: toWarehouseId,
          location_id: to_location_id,
          stock_id: toStockId,
          type: "TRANSFER_IN",
          quantity,
          before_qty: toBefore,
          after_qty: toBefore + quantity,
        },
      });

      // 🔥 7. 알림
      const materialName = fromStock.material?.name || "자재";

      await tx.notification.create({
        data: {
          user_id: user.id,
          type: "STOCK",
          title: "재고 이동",
          action: "MOVE",
          message: `${materialName} ${quantity}개 이동 (${fromLocation.name} → ${toLocation.name})`,
          target_type: "stock",
          target_id: fromStock.id,
        },
      });

      return true;
    });
  },
};
