import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { generateQR } from "../utils/qrcode.js";

export default {
  // 전체 목록 조회
  async getAllList() {
    return prisma.returnOrder.findMany({
      include: {
        items: {
          include: {
            material: true,
            warehouse: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });
  },

  // 보드용 카운트 및 통계
  async boardCount() {
    try {
      // 1. 전체 반품 건수
      const totalCount = await prisma.returnOrder.count();

      // 2. 반품 통계 합계 (수량, 금액, 이익 등)
      const summary = await prisma.returnOrderItem.aggregate({
        _sum: {
          quantity: true,
          sale_amount: true,
          cost_amount: true,
          profit: true,
        },
      });

      // 3. 자재별 반품 빈도 (Raw Query 문법 수정)
      // 테이블명이 @map("return_order_items")로 되어 있는지 확인하세요.
      const rows = await prisma.$queryRaw`
        SELECT 
          m.name as name,
          CAST(COUNT(*) AS CHAR) as count
        FROM return_order_items oi
        JOIN Material m ON m.id = oi.material_id
        GROUP BY m.name
      `;

      // 4. 결과를 { "자재명": 갯수 } 형태로 변환
      const groupCount = rows.reduce((acc, row) => {
        acc[row.name] = Number(row.count);
        return acc;
      }, {});

      return {
        totalCount,
        groupCount,
        summary: summary._sum || {
          quantity: 0,
          sale_amount: 0,
          cost_amount: 0,
          profit: 0,
        },
      };
    } catch (error) {
      console.error("Board stats error:", error);
      throw new AppError("통계 데이터를 가져오는 중 오류가 발생했습니다.");
    }
  },

  // 필터링 목록 조회
  async getList(data) {
    const where = {};

    if (data?.return_no) {
      where.return_no = { contains: data.return_no };
    }

    if (data?.status) {
      where.status = data.status;
    }

    if (data?.startDate && data?.endDate) {
      where.createdAt = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    const rows = await prisma.returnOrder.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: { created_at: "desc" },
    });

    const result = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        qrcode: await generateQR(row.return_no),
      })),
    );

    return result;
  },

  // 상세 페이지 조회
  async getDetailList(data) {
    const where = {};

    if (data?.return_no) {
      where.return_no = { contains: data.return_no };
    }

    if (data?.material_id) {
      where.material_id = data.material_id;
    }

    if (data?.warehouse_id) {
      where.warehouse_id = data.warehouse_id;
    }

    if (data?.location_id) {
      where.location_id = data.location_id;
    }

    if (data?.status) {
      where.status = data.status;
    }

    if (data.startDate && data.endDate) {
      where.returnOrder = {
        created_at: {
          gte: new Date(data.startDate),
          lte: new Date(data.endDate),
        },
      };
    }

    const rows = await prisma.returnOrderItem.findMany({
      where,
      include: {
        material: true,
        location: true,
        warehouse: true,
        returnOrder: true,
      },
      orderBy: {
        returnOrder: { created_at: "desc" },
      },
    });

    const result = await Promise.all(
      rows.map(async (row) => ({
        ...row,

        qrcode: await generateQR(row.returnOrder.return_no),
        return_no: row.returnOrder.return_no,
        material_code: row.material?.code ?? "",
        material_name: row.material?.name ?? "",
        warehouse_name: row.warehouse?.name ?? "",
        location: row.location?.code ?? "",
        created_at: row.returnOrder?.created_at ?? "",
      })),
    );

    return result;
  },

  // 상세 데이터 단건 조회
  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400);

    const item = await prisma.returnOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            warehouse: true,
            material: true,
            location: true,
          },
        },
      },
    });

    if (!item) throw new AppError("존재하지 않는 데이터 입니다.", 404);
    return item;
  },

  /**
   * 재고 처리 로직 (반품은 재고를 증가(+) 시킵니다)
   * @param {number} diffQty - 변화량 (반품 등록 시 +, 삭제 시 -)
   */
  async updateStock(tx, item, diffQty, refTable, refId, userId) {
    // 반품은 해당 위치에 재고가 없을 수도 있으므로 upsert 사용
    const stock = await tx.stock.upsert({
      where: {
        material_id_warehouse_id_location_id: {
          material_id: item.material_id,
          warehouse_id: item.warehouse_id,
          location_id: item.location_id,
        },
      },
      update: {
        quantity: { increment: diffQty },
        updated_by: userId,
      },
      create: {
        material_id: item.material_id,
        warehouse_id: item.warehouse_id,
        location_id: item.location_id,
        quantity: diffQty,
        updated_by: userId,
      },
    });

    const beforeQty = stock.quantity - diffQty;
    const afterQty = stock.quantity;

    // 수불 이력 생성
    await tx.stockHistory.create({
      data: {
        material_id: item.material_id,
        warehouse_id: item.warehouse_id,
        location_id: item.location_id,
        stock_id: stock.id,
        type: "RETURNORDER",
        quantity: diffQty,
        before_qty: beforeQty,
        after_qty: afterQty,
        unit_cost: stock.avg_cost ?? 0,
        amount: (stock.avg_cost ?? 0) * Math.abs(diffQty),
        ref_table: refTable,
        ref_id: refId,
        created_by: userId,
      },
    });
  },

  /**
   * 반품 저장 (등록 및 수정)
   */
  async save(data, user) {
    return prisma.$transaction(async (tx) => {
      let returnOrder;

      // 1. 마스터 정보 생성/수정
      if (!data.id) {
        // 중복 번호 체크
        const exist = await tx.returnOrder.findUnique({
          where: { return_no: data.return_no },
        });
        if (exist) throw new AppError("이미 존재하는 반품번호입니다.", 400);

        returnOrder = await tx.returnOrder.create({
          data: {
            user_id: user.id,
            return_no: data.return_no || `RET-${Date.now()}`,
            status: data.status || "REQUESTED",
            memo: data.memo,
            totalAmount: data.totalAmount || 0,
            created_by: user.id,
            updated_by: user.id,
          },
        });
      } else {
        returnOrder = await tx.returnOrder.update({
          where: { id: data.id },
          data: {
            return_no: data.return_no,
            status: data.status,
            memo: data.memo,
            totalAmount: data.totalAmount,
            updated_by: user.id,
          },
        });
      }

      // 2. 상세 품목 처리 (기존 품목 삭제 후 재등록 방식 또는 비교 방식)
      // 여기서는 기존 소스의 로직을 유지하여 재고를 역계산 후 재반영합니다.
      const oldItems = data.id
        ? await tx.returnOrderItem.findMany({
            where: { returnOrder_id: returnOrder.id },
          })
        : [];

      // 기존 항목 재고 원복 (반품은 재고를 늘렸었으므로 원복 시에는 뺌)
      for (const oldItem of oldItems) {
        await this.updateStock(
          tx,
          oldItem,
          -oldItem.quantity,
          "RETURN_UPDATE_CANCEL",
          returnOrder.id,
          user.id,
        );
      }

      // 기존 상세 삭제
      if (data.id) {
        await tx.returnOrderItem.deleteMany({
          where: { returnOrder_id: returnOrder.id },
        });
      }

      // 새 항목 등록 및 재고 반영
      for (const item of data.items) {
        await tx.returnOrderItem.create({
          data: {
            returnOrder_id: returnOrder.id,
            material_id: item.material_id,
            warehouse_id: item.warehouse_id,
            location_id: item.location_id,
            quantity: item.quantity,
            sale_price: item.sale_price,
            sale_amount: item.quantity * item.sale_price,
            cost_price: item.cost_price || 0,
            cost_amount: item.quantity * (item.cost_price || 0),
            profit: (item.sale_price - (item.cost_price || 0)) * item.quantity,
            reasonType: item.reasonType || "기타",
            stockStatus:
              returnOrder.status === "COMPLETED" ? "RESTOCKED" : "READY",
          },
        });

        // 반품 확정 상태라면 재고 증가(+)
        if (returnOrder.status === "COMPLETED") {
          await this.updateStock(
            tx,
            item,
            item.quantity,
            "RETURNORDER",
            returnOrder.id,
            user.id,
          );
        }
      }

      // 알림 등록
      await tx.notification.create({
        data: {
          user_id: user.id,
          type: "RETURNORDER",
          title: "반품 알림",
          action: data.id ? "UPDATE" : "CREATE",
          message: `[${returnOrder.return_no}] 반품 정보가 ${data.id ? "수정" : "등록"}되었습니다.`,
          target_type: "RETURNORDER",
          target_id: returnOrder.id,
        },
      });

      return returnOrder;
    });
  },

  /**
   * 반품 삭제 (재고 원복)
   */
  async deleteById(id) {
    return prisma.$transaction(async (tx) => {
      const returnOrder = await tx.returnOrder.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!returnOrder) throw new AppError("반품 전표가 없습니다.");

      // 이미 재고에 반영된 경우에만 재고를 차감(-)하여 원복
      if (returnOrder.status === "COMPLETED") {
        for (const item of returnOrder.items) {
          await this.updateStock(
            tx,
            item,
            -item.quantity,
            "RETURN_CANCEL",
            returnOrder.id,
            returnOrder.user_id,
          );
        }
      }

      await tx.returnOrder.delete({ where: { id } });
      return true;
    });
  },

  async batchDelete(data = []) {
    if (!data.length) throw new AppError("요청데이터가 없습니다.", 400);
    return Promise.all(data.map((row) => this.deleteById(row.id)));
  },
};
