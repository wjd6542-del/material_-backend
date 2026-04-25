import prisma from "../lib/prisma.js";
import dayjs from "dayjs";

export default {
  /**
   * 대시보드 종합 지표 조회
   * (Prisma $transaction 으로 14개 쿼리 병렬 실행)
   * - 오늘 입/출고/매출/반품/재고이동 수량
   * - 현재 총 재고량
   * - 30일 입고/출고/반품 차트 (일자별 수량 groupBy)
   * - 재고 TOP 10 / 안전재고 미달 품목
   * - 최근 감사 로그 10건
   * - 이번 달 매출·지출·순이익 계산 (InboundDailyStat / OutboundDailyStat 합계)
   */
  async getDashboard() {
    // 🔥 오늘
    const todayStart = dayjs().startOf("day").toDate();
    const todayEnd = dayjs().endOf("day").toDate();

    // 🔥 최근 30일
    const thirtyDaysAgo = dayjs().subtract(30, "day").startOf("day").toDate();

    // 🔥 이번달
    const monthStart = dayjs().startOf("month").toDate();
    const monthEnd = dayjs().endOf("month").toDate();

    const [
      todayInbound,
      todayOutbound,
      todaySales,
      totalStock,
      todayReturn,
      totaltransfer,
      inboundChartRaw,
      outboundChartRaw,
      returnChartRaw,
      topStock,
      lowStockRaw,
      logs,
      monthInboundStat,
      monthOutboundStat,
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

      // 오늘 반품
      prisma.returnOrderItem.aggregate({
        _sum: { quantity: true },
        where: {
          returnOrder: {
            created_at: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
        },
      }),

      // 오늘 재고이동
      prisma.stockHistory.count({
        where: {
          type: "TRANSFER_OUT", // 🔥 이동 타입
          created_at: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      }),

      /*
        입고 차트 (30일)
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
        출고 차트 (30일)
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
        반품 차트 (30일)
      */
      prisma.returnDailyStat.groupBy({
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

      /*
        🔥 이번달 입고 (지출)
      */
      prisma.inboundDailyStat.aggregate({
        _sum: {
          total_cost: true, // 🔥 입고 금액
        },
        where: {
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      }),

      /*
        🔥 이번달 출고 (수익)
      */
      prisma.outboundDailyStat.aggregate({
        _sum: {
          total_sales: true, // 🔥 매출
        },
        where: {
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      }),
    ]);

    /*
      부족 재고 필터
    */
    const grouped = {};

    for (const v of lowStockRaw) {
      if (!grouped[v.material_id]) {
        grouped[v.material_id] = {
          material_id: v.material_id,
          material_name: v.material.name,
          safety_stock: v.material.safety_stock,
          stock: 0,
        };
      }

      grouped[v.material_id].stock += v.quantity;
    }

    const lowStock = Object.values(grouped).filter(
      (v) => v.stock < v.safety_stock,
    );

    /*
      🔥 이번달 계산 (통계 기반)
    */
    const totalMonthExpense = monthInboundStat._sum.total_cost ?? 0;
    const totalMonthSales = monthOutboundStat._sum.total_sales ?? 0;
    const netProfit = totalMonthSales - totalMonthExpense;

    return {
      summary: {
        // 입고 수량
        today_inbound: todayInbound._sum.quantity ?? 0,
        // 출고 수량
        today_outbound: todayOutbound._sum.quantity ?? 0,
        // 재고 수량
        total_stock: totalStock._sum.quantity ?? 0,
        // 판매금액
        today_sales: todaySales._sum.sale_amount ?? 0,
        // 오늘 재고이동
        today_transfers: totaltransfer ?? 0,
        // 오늘 반품 수량
        today_returns: todayReturn._sum.quantity ?? 0,

        // 이번달 통계
        month_sales: totalMonthSales,
        month_expense: totalMonthExpense,
        month_profit: netProfit,
      },

      inbound_chart: inboundChartRaw.map((v) => ({
        date: dayjs(v.date).format("MM-DD"),
        qty: v._sum.total_qty ?? 0,
      })),

      outbound_chart: outboundChartRaw.map((v) => ({
        date: dayjs(v.date).format("MM-DD"),
        qty: v._sum.total_qty ?? 0,
      })),

      return_chart: returnChartRaw.map((v) => ({
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
