import prisma from "../lib/prisma.js";
import dayjs from "dayjs";

export default {
  async getDashboard() {
    const todayStart = dayjs().startOf("day").toDate();
    const todayEnd = dayjs().endOf("day").toDate();
    const thirtyDaysAgo = dayjs().subtract(30, "day").startOf("day").toDate();

    const [
      todayInbound,
      todayOutbound,
      todaySales,
      totalStock,
      inboundChartRaw,
      outboundChartRaw,
      topStock,
      lowStockRaw,
      logs,
    ] = await prisma.$transaction([
      /*
        오늘 입고
      */
      prisma.inboundItem.aggregate({
        _sum: { quantity: true },
        where: {
          inbound: {
            created_at: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
        },
      }),

      /*
        오늘 출고
      */
      prisma.outboundItem.aggregate({
        _sum: { quantity: true },
        where: {
          outbound: {
            created_at: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
        },
      }),

      /*
        오늘 매출
      */
      prisma.outboundItem.aggregate({
        _sum: { sale_amount: true },
        where: {
          outbound: {
            created_at: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
        },
      }),

      /*
        총 재고
      */
      prisma.stock.aggregate({
        _sum: { quantity: true },
      }),

      /*
        입고 차트
      */
      prisma.inboundDailyStat.groupBy({
        by: ["date"],
        where: {
          date: { gte: thirtyDaysAgo },
        },
        _sum: {
          total_qty: true,
        },
        orderBy: {
          date: "asc",
        },
      }),

      /*
        출고 차트
      */
      prisma.outboundDailyStat.groupBy({
        by: ["date"],
        where: {
          date: { gte: thirtyDaysAgo },
        },
        _sum: {
          total_qty: true,
        },
        orderBy: {
          date: "asc",
        },
      }),

      /*
        재고 TOP
      */
      prisma.stock.findMany({
        take: 10,
        orderBy: {
          quantity: "desc",
        },
        include: {
          material: true,
        },
      }),

      /*
        부족 재고
      */
      prisma.stock.findMany({
        include: {
          material: true,
        },
      }),

      /*
        최근 로그
      */
      prisma.auditLog.findMany({
        take: 10,
        orderBy: {
          created_at: "desc",
        },
        include: {
          user: true,
        },
      }),
    ]);

    /*
      부족 재고 필터 (컬럼 비교)
    */
    const lowStock = lowStockRaw
      .filter((v) => v.quantity < v.material.safety_stock)
      .map((v) => ({
        material_id: v.material_id,
        material_name: v.material.name,
        stock: v.quantity,
        safety_stock: v.material.safety_stock,
      }));

    return {
      summary: {
        today_inbound: todayInbound._sum.quantity ?? 0,
        today_outbound: todayOutbound._sum.quantity ?? 0,
        total_stock: totalStock._sum.quantity ?? 0,
        today_sales: todaySales._sum.sale_amount ?? 0,
      },

      inbound_chart: inboundChartRaw.map((v) => ({
        date: dayjs(v.date).format("MM-DD"),
        qty: v._sum.total_qty ?? 0,
      })),

      outbound_chart: outboundChartRaw.map((v) => ({
        date: dayjs(v.date).format("MM-DD"),
        qty: v._sum.total_qty ?? 0,
      })),

      top_stock: topStock.map((v) => ({
        material_id: v.material_id,
        name: v.material.name,
        qty: v.quantity,
      })),

      low_stock: lowStock,

      logs,
    };
  },
};
