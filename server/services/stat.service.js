import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

class StatService {
  // 날자 처리
  getDateRange(date = null) {
    const target = date ? new Date(date) : new Date();

    const start = new Date(target);
    start.setHours(0, 0, 0, 0);

    const end = new Date(target);
    end.setHours(23, 59, 59, 999);

    const end_field = new Date(target);
    return { start, end, end_field };
  }

  // 입고 통계 리스트 확인
  async inboundList(data) {
    const where = {};

    if (data.material_id) {
      where.material_id = data.material_id;
    }

    if (data.startDate && data.endDate) {
      where.date = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    const rows = await prisma.inboundDailyStat.findMany({
      where,
      include: {
        material: true,
      },
      orderBy: { date: "desc" },
    });

    const result = rows.map((r) => ({
      ...r,
      date: r.date.toISOString().slice(0, 10),
      material_name: r.material?.name ?? "",
    }));
    return result;
  }

  // 입고 통계 리스트 확인
  async outboundList(data) {
    const where = {};

    if (data.material_id) {
      where.material_id = data.material_id;
    }

    if (data.startDate && data.endDate) {
      where.date = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    const rows = await prisma.outboundDailyStat.findMany({
      where,
      include: {
        material: true,
      },
      orderBy: { date: "desc" },
    });

    const result = rows.map((r) => ({
      ...r,
      date: r.date.toISOString().slice(0, 10),
      material_name: r.material?.name ?? "",
    }));
    return result;
  }

  // 재고 통계 리스트 확인
  async stockList(data) {
    const where = {};

    if (data.material_id) {
      where.material_id = data.material_id;
    }

    if (data.startDate && data.endDate) {
      where.date = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    const rows = await prisma.StockDailySnapshot.findMany({
      where,
      include: {
        material: true,
        warehouse: true,
      },
      orderBy: { date: "desc" },
    });

    const result = rows.map((r) => ({
      ...r,
      date: r.date.toISOString().slice(0, 10),
      material_name: r.material?.name ?? "",
      warehouse_name: r.warehouse?.name ?? "",
    }));
    return result;
  }

  // 일별 일고 처리
  async createInboundDailyStat(date = null) {
    const { start, end, end_field } = this.getDateRange(date);
    const rows = await prisma.inboundItem.groupBy({
      by: ["material_id"],
      _sum: {
        quantity: true,
        amount: true,
      },
      where: {
        inbound: {
          created_at: {
            gte: start,
            lte: end,
          },
        },
      },
    });

    if (rows.length == 0) {
      throw new AppError("조회된 결과가 없습니다.", "NO_DATA");
    }

    for (const r of rows) {
      await prisma.inboundDailyStat.upsert({
        where: {
          date_material_id: {
            date: end_field,
            material_id: r.material_id,
          },
        },
        update: {
          total_qty: r._sum.quantity ?? 0,
          total_cost: r._sum.amount ?? 0,
        },
        create: {
          date: end_field,
          material_id: r.material_id,
          total_qty: r._sum.quantity ?? 0,
          total_cost: r._sum.amount ?? 0,
        },
      });
    }

    return {
      success: true,
      count: rows.length,
    };
  }

  /**
   * 출고 일별 통계
   */
  async createOutboundDailyStat(date = null) {
    const { start, end, end_field } = this.getDateRange(date);

    const rows = await prisma.outboundItem.groupBy({
      by: ["material_id"],
      _sum: {
        quantity: true,
        sale_amount: true,
        cost_amount: true,
        profit: true,
      },
      where: {
        outbound: {
          created_at: {
            gte: start,
            lte: end,
          },
        },
      },
    });

    if (!rows.length) {
      return { type: "outbound", count: 0 };
    }

    const data = rows.map((r) => ({
      date: end_field,
      material_id: r.material_id,
      total_qty: Number(r._sum.quantity ?? 0),
      total_sales: Number(r._sum.sale_amount ?? 0),
      total_cost: Number(r._sum.cost_amount ?? 0),
      total_profit: Number(r._sum.profit ?? 0),
    }));

    await prisma.$transaction([
      prisma.outboundDailyStat.deleteMany({
        where: {
          date: {
            gte: start,
            lt: end,
          },
        },
      }),
      prisma.outboundDailyStat.createMany({
        data,
        skipDuplicates: true,
      }),
    ]);

    return {
      type: "outbound",
      count: data.length,
    };
  }

  // 일별 재고 처리
  async createStockDailyStat(date = null) {
    const target = date ? new Date(date) : new Date();

    target.setHours(0, 0, 0, 0);

    const stocks = await prisma.stock.findMany({
      select: {
        material_id: true,
        warehouse_id: true,
        quantity: true,
      },
    });

    for (const s of stocks) {
      await prisma.stockDailySnapshot.upsert({
        where: {
          date_material_id_warehouse_id: {
            date: target,
            material_id: s.material_id,
            warehouse_id: s.warehouse_id,
          },
        },
        update: {
          quantity: s.quantity,
        },
        create: {
          date: target,
          material_id: s.material_id,
          warehouse_id: s.warehouse_id,
          quantity: s.quantity,
        },
      });
    }

    return {
      type: "stock",
      count: stocks.length,
    };
  }

  // 입고 차트용
  async inboundDailyTotalAmount(data) {
    const where = {};
    if (data.startDate && data.endDate) {
      where.date = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    const rows = await prisma.inboundDailyStat.groupBy({
      where,
      by: ["date"],
      _sum: {
        total_qty: true,
        total_cost: true,
      },
      orderBy: { date: "desc" },
    });

    const result = rows.map((r) => ({
      ...r,
      date: r.date.toISOString().slice(0, 10),
      total_qty: r._sum.total_qty,
      total_cost: r._sum.total_cost,
    }));
    return result;
  }

  // 춝고 차트용
  async outboundDailyTotalAmount(data) {
    const where = {};
    if (data.startDate && data.endDate) {
      where.date = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    const rows = await prisma.outboundDailyStat.groupBy({
      where,
      by: ["date"],
      _sum: {
        // 갯수 합계
        total_qty: true,
        // 원가 합계
        total_cost: true,
        // 판매가 합계
        total_sales: true,
        // 순익 합계
        total_profit: true,
      },
      orderBy: { date: "desc" },
    });

    const result = rows.map((r) => ({
      ...r,
      date: r.date.toISOString().slice(0, 10),
      total_qty: r._sum.total_qty,
      total_cost: r._sum.total_cost,
      total_sales: r._sum.total_sales,
      total_profit: r._sum.total_profit,
    }));
    return result;
  }

  // 재고 차트용
  async stockDailyTotalQty(data) {
    const where = {};
    if (data.startDate && data.endDate) {
      where.date = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    const rows = await prisma.stockDailySnapshot.groupBy({
      where,
      by: ["date"],
      _sum: {
        quantity: true,
      },
      orderBy: { date: "desc" },
    });

    const result = rows.map((r) => ({
      ...r,
      date: r.date.toISOString().slice(0, 10),
      total_qty: r._sum.quantity,
    }));
    return result;
  }
}

export default new StatService();
