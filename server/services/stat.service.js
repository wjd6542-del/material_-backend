import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

class StatService {
  // ==============================
  // 공통 유틸
  // ==============================

  // KST 기준 날짜 범위
  getDateRange(date = null) {
    const target = date ? new Date(`${date}T00:00:00+09:00`) : new Date();

    const start = new Date(target);
    start.setHours(0, 0, 0, 0);

    const end = new Date(target);
    end.setHours(23, 59, 59, 999);

    return { start, end, target };
  }

  // 날짜 문자열 변환
  formatDate(date) {
    return new Date(date).toISOString().slice(0, 10);
  }

  // 조회용 날짜 where 생성
  buildDateWhere(data) {
    if (!data.startDate || !data.endDate) return {};

    const start = new Date(`${data.startDate}T00:00:00+09:00`);
    const end = new Date(`${data.endDate}T23:59:59+09:00`);

    return {
      date: {
        gte: start,
        lte: end,
      },
    };
  }

  // ==============================
  // 리스트 조회
  // ==============================

  async inboundList(data) {
    const where = {
      ...this.buildDateWhere(data),
      ...(data.material_id && { material_id: data.material_id }),
    };

    const rows = await prisma.inboundDailyStat.findMany({
      where,
      include: { material: true },
      orderBy: { date: "desc" },
    });

    return rows.map((r) => ({
      ...r,
      date: this.formatDate(r.date),
      material_name: r.material?.name ?? "",
    }));
  }

  async outboundList(data) {
    const where = {
      ...this.buildDateWhere(data),
      ...(data.material_id && { material_id: data.material_id }),
    };

    const rows = await prisma.outboundDailyStat.findMany({
      where,
      include: { material: true },
      orderBy: { date: "desc" },
    });

    return rows.map((r) => ({
      ...r,
      date: this.formatDate(r.date),
      material_name: r.material?.name ?? "",
    }));
  }

  async stockList(data) {
    const where = {
      ...this.buildDateWhere(data),
      ...(data.material_id && { material_id: data.material_id }),
    };

    const rows = await prisma.stockDailySnapshot.findMany({
      where,
      include: {
        material: true,
        warehouse: true,
      },
      orderBy: { date: "desc" },
    });

    return rows.map((r) => ({
      ...r,
      date: this.formatDate(r.date),
      material_name: r.material?.name ?? "",
      warehouse_name: r.warehouse?.name ?? "",
    }));
  }

  // ==============================
  // 입고 일별 통계
  // ==============================

  async createInboundDailyStat(date = null) {
    const { start, end, target } = this.getDateRange(date);

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

    if (!rows.length) {
      throw new AppError("조회된 결과가 없습니다.", "NO_DATA");
    }

    await Promise.all(
      rows.map((r) =>
        prisma.inboundDailyStat.upsert({
          where: {
            date_material_id: {
              date: target,
              material_id: r.material_id,
            },
          },
          update: {
            total_qty: Number(r._sum.quantity ?? 0),
            total_cost: Number(r._sum.amount ?? 0),
          },
          create: {
            date: target,
            material_id: r.material_id,
            total_qty: Number(r._sum.quantity ?? 0),
            total_cost: Number(r._sum.amount ?? 0),
          },
        }),
      ),
    );

    return {
      type: "inbound",
      count: rows.length,
    };
  }

  // ==============================
  // 출고 일별 통계 (🔥 수정 완료)
  // ==============================

  async createOutboundDailyStat(date = null) {
    const { start, end, target } = this.getDateRange(date);

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

    await Promise.all(
      rows.map((r) =>
        prisma.outboundDailyStat.upsert({
          where: {
            date_material_id: {
              date: target,
              material_id: r.material_id,
            },
          },
          update: {
            total_qty: Number(r._sum.quantity ?? 0),
            total_sales: Number(r._sum.sale_amount ?? 0),
            total_cost: Number(r._sum.cost_amount ?? 0),
            total_profit: Number(r._sum.profit ?? 0),
          },
          create: {
            date: target,
            material_id: r.material_id,
            total_qty: Number(r._sum.quantity ?? 0),
            total_sales: Number(r._sum.sale_amount ?? 0),
            total_cost: Number(r._sum.cost_amount ?? 0),
            total_profit: Number(r._sum.profit ?? 0),
          },
        }),
      ),
    );

    return {
      type: "outbound",
      count: rows.length,
    };
  }

  // ==============================
  // 재고 스냅샷
  // ==============================

  async createStockDailyStat(date = null) {
    const { target } = this.getDateRange(date);

    const stocks = await prisma.stock.findMany({
      select: {
        material_id: true,
        warehouse_id: true,
        quantity: true,
      },
    });

    await Promise.all(
      stocks.map((s) =>
        prisma.stockDailySnapshot.upsert({
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
        }),
      ),
    );

    return {
      type: "stock",
      count: stocks.length,
    };
  }

  // ==============================
  // 차트용
  // ==============================

  async inboundDailyTotalAmount(data) {
    const where = this.buildDateWhere(data);

    const rows = await prisma.inboundDailyStat.groupBy({
      where,
      by: ["date"],
      _sum: {
        total_qty: true,
        total_cost: true,
      },
      orderBy: { date: "asc" },
    });

    return rows.map((r) => ({
      date: this.formatDate(r.date),
      total_qty: r._sum.total_qty ?? 0,
      total_cost: r._sum.total_cost ?? 0,
    }));
  }

  async outboundDailyTotalAmount(data) {
    const where = this.buildDateWhere(data);

    const rows = await prisma.outboundDailyStat.groupBy({
      where,
      by: ["date"],
      _sum: {
        total_qty: true,
        total_cost: true,
        total_sales: true,
        total_profit: true,
      },
      orderBy: { date: "asc" },
    });

    return rows.map((r) => ({
      date: this.formatDate(r.date),
      total_qty: r._sum.total_qty ?? 0,
      total_cost: r._sum.total_cost ?? 0,
      total_sales: r._sum.total_sales ?? 0,
      total_profit: r._sum.total_profit ?? 0,
    }));
  }

  async stockDailyTotalQty(data) {
    const where = this.buildDateWhere(data);

    const rows = await prisma.stockDailySnapshot.groupBy({
      where,
      by: ["date"],
      _sum: {
        quantity: true,
      },
      orderBy: { date: "asc" },
    });

    return rows.map((r) => ({
      date: this.formatDate(r.date),
      total_qty: r._sum.quantity ?? 0,
    }));
  }
}

export default new StatService();
