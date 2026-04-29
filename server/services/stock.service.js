import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { generateQR } from "../utils/qrcode.js";
import { ensureStockRow, lockStockById } from "./stock.lock.js";

export default {
  /**
   * 재고 건수 및 총 수량 집계 (대시보드 카드 등)
   * @returns {Promise<{count:number,total_qty:number}>}
   */
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

  /**
   * 안전재고(Material.safety_stock) 미만인 품목 TOP N
   * 품목별 재고를 groupBy 로 합산 후 safety_stock 과 비교
   * @param {{limit?:number}} data (기본 10)
   */
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

  /**
   * 재고 전체 리스트 (sort asc)
   */
  async getAllList(data) {
    return prisma.stock.findMany({
      orderBy: { sort: "asc" },
    });
  },

  /**
   * 재고 리스트 (복합 필터)
   * - in_stock: 수량>0 만
   * - material_id / warehouse_id / location_id
   * - startDate/endDate (updated_at)
   * - scan_code: 품목 코드·이름 부분 매칭 → 매칭된 품목들의 재고만 반환
   * 품목·창고·위치 정보를 조인하고 QR 코드를 생성해 함께 반환
   */
  async getList(data) {
    const where = {};

    // 재고 존재 여부
    if (data?.in_stock) {
      where.quantity = {
        gt: 0, // 0보다 큰 재고만
      };
    }

    // 품목 검색
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

  /**
   * 재고 페이지네이션 리스트 (getList 와 동일 필터 + page/limit)
   * @param {Object} data
   * @returns {Promise<{rows:Array,total:number,page:number,limit:number,totalPages:number}>}
   */
  async getPageList(data) {
    const where = {};

    if (data?.in_stock) {
      where.quantity = { gt: 0 };
    }

    if (data?.material_id) where.material_id = data.material_id;
    if (data?.warehouse_id) where.warehouse_id = data.warehouse_id;
    if (data?.location_id) where.location_id = data.location_id;

    if (data?.startDate && data?.endDate) {
      where.updated_at = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    if (data?.scan_code) {
      const materials = await prisma.material.findMany({
        where: {
          OR: [
            { code: { contains: data.scan_code } },
            { name: { contains: data.scan_code } },
          ],
        },
        select: { id: true },
      });

      if (!materials.length) {
        throw new AppError("제품을 찾지못했습니다.", 404, "NOT_FOUND");
      }

      const materialIds = materials.map((m) => m.id);
      if (materialIds.length) {
        where.material_id = { in: materialIds };
      }
    }

    const page = Math.max(1, Number(data?.page) || 1);
    const limit = Math.max(1, Math.min(Number(data?.limit) || 20, 100));
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.stock.findMany({
        where,
        include: {
          material: true,
          warehouse: true,
          location: true,
        },
        orderBy: { updated_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.stock.count({ where }),
    ]);

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

    return {
      rows: result,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * 재고 단건 조회
   * @param {number} id Stock.id
   */
  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.stock.findUnique({ where: { id } });
    if (!item) {
      throw new AppError("존재하지 않는 편의시설입니다.", 404, "NOT_FOUND");
    }
    return item;
  },

  /**
   * StockHistory(재고 변동이력) 리스트 조회
   * (material/warehouse/location/type/검색어/기간 필터 + 품목·창고·위치 조인)
   */
  async getDetailList(data) {
    const where = {};

    // 품목 검색
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

    // 검색 기준 적용
    // 품목명, 품목코드 검색
    if (data?.searchText) {
      const materials = await prisma.material.findMany({
        where: {
          OR: [
            {
              name: {
                contains: data.searchText,
              },
            },
            {
              code: {
                contains: data.searchText,
              },
            },
          ],
        },
        select: {
          id: true,
        },
      });

      where.material_id = {
        in: materials.map((m) => m.id),
      };
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

  /**
   * StockHistory 페이지네이션 리스트 (getDetailList 와 동일 필터 + page/limit)
   * @param {Object} data
   * @returns {Promise<{rows:Array,total:number,page:number,limit:number,totalPages:number}>}
   */
  async getDetailPageList(data) {
    const where = {};

    if (data.material_id) where.material_id = data.material_id;
    if (data.warehouse_id) where.warehouse_id = data.warehouse_id;
    if (data.location_id) where.location_id = data.location_id;
    if (data.type) where.type = data.type;

    if (data?.searchText) {
      const materials = await prisma.material.findMany({
        where: {
          OR: [
            { name: { contains: data.searchText } },
            { code: { contains: data.searchText } },
          ],
        },
        select: { id: true },
      });

      where.material_id = {
        in: materials.map((m) => m.id),
      };
    }

    if (data.startDate && data.endDate) {
      where.created_at = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    const page = Math.max(1, Number(data?.page) || 1);
    const limit = Math.max(1, Math.min(Number(data?.limit) || 20, 100));
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.stockHistory.findMany({
        where,
        include: {
          material: true,
          warehouse: true,
          location: true,
        },
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.stockHistory.count({ where }),
    ]);

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

    return {
      rows: result,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * 창고별 품목 재고 집계 (도면 표시용 points/rotation 포함)
   * 1) Warehouse 전체 조회 → 2) Stock groupBy(warehouse,material) → 3) 품목+대표이미지 조회
   * → 4) 창고 id 로 stocks 배열 매핑 → 반환
   */
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

    // 3️⃣ 품목 정보 조회

    const materials = await prisma.material.findMany({
      where: {
        id: { in: stocks.map((v) => v.material_id) },
      },
      select: {
        id: true,
        name: true,
        code: true,
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

    // 4️⃣ warehouse_id 기준 map 생성
    const stockMap = {};

    stocks.forEach((v) => {
      if (!stockMap[v.warehouse_id]) {
        stockMap[v.warehouse_id] = [];
      }

      const material = materialMap[v.material_id];
      const image = material?.images?.[0];

      stockMap[v.warehouse_id].push({
        id: v.material_id,
        // 자제명
        material_name: materialMap[v.material_id]?.name,
        // 자제코드
        material_code: materialMap[v.material_id]?.code,
        // 수량
        qty: v._sum.quantity,

        // 품목 이미지
        image: image || null,
        image_url: image?.file_url || null,
      });
    });

    // 5️⃣ 랙 구조로 변환
    return racks.map((rack) => ({
      id: rack.id,
      name: rack.name,
      code: rack.code,
      points: rack.points,
      rotation: rack.rotation,
      stocks: stockMap[rack.id] || [],
    }));
  },

  /**
   * 위치(Location) 기준 품목 재고 집계
   * (warehouse_id 로 선택 필터링, 대표 이미지 포함)
   */
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

    // 3️⃣ 품목 + 이미지 조회 (🔥 여기 수정)
    const materials = await prisma.material.findMany({
      where: {
        id: { in: materialIds },
      },
      select: {
        id: true,
        name: true,
        code: true,
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
        // 자제명
        material_name: material?.name,
        // 자제코드
        material_code: material?.code,
        // 수량
        qty: v._sum.quantity,

        // 품목 이미지
        image: image || null,
        image_url: image?.file_url || null,
      });
    });

    console.log("locations >> 정보 확인", locations);

    // 5️⃣ 반환
    return locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      code: loc.code,
      warehouse_id: loc.warehouse_id,
      points: loc.points,
      rotation: loc.rotation,
      stocks: stockMap[loc.id] || [],
    }));
  },

  /**
   * 선반(Shelf) 기준 품목 재고 집계 (좌표/크기 포함)
   * warehouse_id, location_id 로 범위 필터 가능
   */
  async shelfStock(data) {
    const where = {};

    if (data.warehouse_id) {
      where.location = { warehouse_id: data.warehouse_id };
    }
    if (data.location_id) {
      where.location_id = data.location_id;
    }

    // 1️⃣ 선반 조회
    const shelves = await prisma.shelf.findMany({
      where,
      orderBy: { sort: "asc" },
    });

    const shelfIds = shelves.map((v) => v.id);

    // 2️⃣ 재고 groupBy
    const stocks = await prisma.stock.groupBy({
      by: ["shelf_id", "material_id"],
      where: {
        shelf_id: { in: shelfIds },
      },
      _sum: {
        quantity: true,
      },
    });

    const materialIds = stocks.map((v) => v.material_id);

    // 3️⃣ 품목 + 이미지 조회
    const materials = await prisma.material.findMany({
      where: {
        id: { in: materialIds },
      },
      select: {
        id: true,
        name: true,
        code: true,
        images: {
          select: {
            id: true,
            file_url: true,
            file_name: true,
          },
          orderBy: { sort: "asc" },
          take: 1,
        },
      },
    });

    const materialMap = Object.fromEntries(materials.map((v) => [v.id, v]));

    // 4️⃣ stock map
    const stockMap = {};

    stocks.forEach((v) => {
      if (!stockMap[v.shelf_id]) {
        stockMap[v.shelf_id] = [];
      }

      const material = materialMap[v.material_id];
      const image = material?.images?.[0];

      stockMap[v.shelf_id].push({
        id: v.material_id,
        material_name: material?.name,
        material_code: material?.code,
        qty: v._sum.quantity,
        image: image || null,
        image_url: image?.file_url || null,
      });
    });

    // 5️⃣ 반환
    return shelves.map((shelf) => ({
      id: shelf.id,
      name: shelf.name,
      code: shelf.code,
      location_id: shelf.location_id,
      x: shelf.x,
      y: shelf.y,
      width: shelf.width,
      height: shelf.height,
      stocks: stockMap[shelf.id] || [],
    }));
  },

  /**
   * 창고/위치 간 재고 이동
   * 트랜잭션 흐름:
   *   1) from/to Location 조회 → warehouse_id 파생
   *   2) 출발 재고 조회 (수량 부족 검사)
   *   3) 출발지 수량 차감
   *   4) 도착 재고 조회 후 존재하면 증감, 없으면 새 Stock 생성
   *   5) StockHistory TRANSFER_OUT / TRANSFER_IN 이력 양쪽 기록
   *   6) STOCK 타입 알림 생성
   * @param {{material_id:number,from_location_id:number,to_location_id:number,quantity:number}} data
   * @param {Object} user 로그인 사용자 (updated_by, created_by 기록)
   */
  async transfer(data, user) {
    const { material_id, from_location_id, to_location_id, quantity } = data;

    if (!material_id) throw new Error("품목 없음");
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

      // 🔥 1. 출발 재고 조회 (shelf 미지정 재고 기준) — 존재 확인 + 부수 정보 수집
      const fromStock = await tx.stock.findUnique({
        where: {
          material_id_warehouse_id_location_id_shelf_id: {
            material_id,
            warehouse_id: fromWarehouseId,
            location_id: from_location_id,
            shelf_id: null,
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

      const fromShelfId = fromStock.shelf_id ?? null;

      // 🔥 2. 도착 행 보장(upsert, 잠금 없이) — 이후 id 오름차순으로 잠금
      const toStockRow = await ensureStockRow(
        tx,
        {
          material_id,
          warehouse_id: toWarehouseId,
          location_id: to_location_id,
          shelf_id: fromShelfId,
        },
        user.id,
      );

      // 🔥 3. deadlock 방지: 두 행을 id 오름차순으로 FOR UPDATE
      const orderedIds = [fromStock.id, toStockRow.id].sort((a, b) => a - b);
      const locks = {};
      for (const id of orderedIds) {
        const l = await lockStockById(tx, id);
        if (!l) throw new Error(`Stock 행 잠금 실패 (id=${id})`);
        locks[id] = l;
      }
      const fromLocked = locks[fromStock.id];
      const toLocked = locks[toStockRow.id];

      if (fromLocked.quantity < quantity) {
        throw new Error("재고 부족");
      }

      const fromBefore = fromLocked.quantity;
      const fromAfter = fromBefore - quantity;
      const fromAvgCost = fromLocked.avg_cost;
      const transferAmount = fromAvgCost * quantity;

      // 🔥 4. 출발지 차감 (stock_value 재계산, avg_cost 유지)
      await tx.stock.update({
        where: { id: fromStock.id },
        data: {
          quantity: fromAfter,
          stock_value: fromAfter <= 0 ? 0 : fromAfter * fromAvgCost,
          updated_by: user.id,
        },
      });

      // 🔥 5. 도착지 증가 (이동평균 병합)
      const toBefore = toLocked.quantity;
      const toStockId = toLocked.id;
      const toOldAvg = toLocked.avg_cost;
      const toAfter = toBefore + quantity;
      const mergedAvg =
        toAfter > 0
          ? (toBefore * toOldAvg + quantity * fromAvgCost) / toAfter
          : 0;

      await tx.stock.update({
        where: { id: toStockId },
        data: {
          quantity: toAfter,
          avg_cost: mergedAvg,
          stock_value: toAfter * mergedAvg,
          updated_by: user.id,
        },
      });

      // 🔥 5. 이력 기록 (OUT)
      await tx.stockHistory.create({
        data: {
          material_id,
          warehouse_id: fromWarehouseId,
          location_id: from_location_id,
          shelf_id: fromShelfId,
          stock_id: fromStock.id,
          type: "TRANSFER_OUT",
          quantity: -quantity,
          before_qty: fromBefore,
          after_qty: fromAfter,
          unit_cost: fromAvgCost,
          amount: transferAmount,
          created_by: user.id,
        },
      });

      // 🔥 6. 이력 기록 (IN)
      await tx.stockHistory.create({
        data: {
          material_id,
          warehouse_id: toWarehouseId,
          location_id: to_location_id,
          shelf_id: fromShelfId,
          stock_id: toStockId,
          type: "TRANSFER_IN",
          quantity,
          before_qty: toBefore,
          after_qty: toBefore + quantity,
          unit_cost: fromAvgCost,
          amount: transferAmount,
          created_by: user.id,
        },
      });

      // 🔥 7. 알림
      const materialName = fromStock.material?.name || "품목";

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
