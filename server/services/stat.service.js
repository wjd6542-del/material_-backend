import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import dayjs from "dayjs";

/**
 * 통계(StatService) 클래스
 * - 일별 입·출고·반품·재고 스냅샷 집계 생성 및 조회
 * - 대시보드·차트 데이터 제공
 * - cron 배치와 수동 재집계 API 가 동일한 createXxxDailyStat 메서드 호출
 */
class StatService {
  // ==============================
  // 공통 유틸
  // ==============================

  /**
   * KST(+09:00) 기준 지정일의 00:00 ~ 23:59.999 범위 계산
   * @param {string|null} date 'YYYY-MM-DD' (null 이면 오늘)
   * @returns {{start:Date,end:Date,target:Date}}
   */
  getDateRange(date = null) {
    const target = date ? new Date(`${date}T00:00:00+09:00`) : new Date();

    const start = new Date(target);
    start.setHours(0, 0, 0, 0);

    const end = new Date(target);
    end.setHours(23, 59, 59, 999);

    return { start, end, target };
  }

  /** Date → 'YYYY-MM-DD' 문자열 포맷 */
  formatDate(date) {
    return new Date(date).toISOString().slice(0, 10);
  }

  /**
   * 리스트 조회용 date 범위 where 생성 (기본값은 오늘)
   * @param {{startDate?:string, endDate?:string}} data
   */
  buildDateWhere(data) {
    const now = new Date();

    // 기본값 (오늘)
    const defaultStart = new Date(now);
    defaultStart.setHours(0, 0, 0, 0);

    const defaultEnd = new Date(now);
    defaultEnd.setHours(23, 59, 59, 999);

    let start;
    let end;

    // startDate 처리
    if (data.startDate) {
      start = new Date(data.startDate);
      if (isNaN(start.getTime())) {
        start = defaultStart;
      }
    } else {
      start = defaultStart;
    }

    // endDate 처리
    if (data.endDate) {
      end = new Date(data.endDate);
      if (isNaN(end.getTime())) {
        end = defaultEnd;
      }
    } else {
      end = defaultEnd;
    }

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

  /** 입고 일별 통계 리스트 (기간/자재 필터, 최신순) */
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

  /** 출고 일별 통계 리스트 */
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

  /** 반품 일별 통계 리스트 */
  async returnList(data) {
    const where = {
      ...this.buildDateWhere(data),
      ...(data.material_id && { material_id: data.material_id }),
    };

    const rows = await prisma.returnDailyStat.findMany({
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

  /** 재고 일별 스냅샷 리스트 (자재·창고 조인) */
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
  /**
   * 지정일 기준 입고 일별 통계(InboundDailyStat) 재생성
   * InboundItem 을 자재별 groupBy 한 뒤 기존 레코드 삭제 후 일괄 생성.
   * cron 배치(매일 00:10)와 수동 API 양쪽에서 호출.
   * @param {string|null} date 'YYYY-MM-DD' (null 이면 오늘)
   * @returns {Promise<{type:'inbound',count:number}>}
   */
  async createInboundDailyStat(date = null) {
    const { start, end, target } = this.getDateRange(date);

    const startDate = dayjs(target).startOf("day").toDate();
    const endDate = dayjs(target).endOf("day").toDate();

    const targetDate = new Date(
      Date.UTC(
        dayjs(target).year(),
        dayjs(target).month(),
        dayjs(target).date(),
      ),
    );

    const rows = await prisma.inboundItem.groupBy({
      by: ["material_id"],
      _sum: {
        quantity: true,
        amount: true,
      },
      where: {
        inbound: {
          created_at: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
    });

    if (!rows.length) {
      return { type: "inbound", count: 0 };
    }

    await prisma.$transaction(async (tx) => {
      await tx.inboundDailyStat.deleteMany({
        where: {
          date: targetDate,
        },
      });

      await tx.inboundDailyStat.createMany({
        data: rows.map((r) => ({
          date: targetDate,
          material_id: r.material_id,
          total_qty: Number(r._sum.quantity ?? 0),
          total_cost: Number(r._sum.amount ?? 0),
        })),
      });
    });
    return {
      type: "inbound",
      count: rows.length,
    };
  }

  // ==============================
  // 출고 일별 통계
  // ==============================
  /**
   * 지정일 기준 출고 일별 통계(OutboundDailyStat) 재생성
   * 자재별 수량/판매금액/원가/이익 합계를 저장.
   */
  async createOutboundDailyStat(date = null) {
    const { start, end, target } = this.getDateRange(date);
    const startDate = dayjs(target).startOf("day").toDate();
    const endDate = dayjs(target).endOf("day").toDate();

    const targetDate = new Date(
      Date.UTC(
        dayjs(target).year(),
        dayjs(target).month(),
        dayjs(target).date(),
      ),
    );

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
            gte: startDate,
            lte: endDate,
          },
        },
      },
    });

    if (!rows.length) {
      return { type: "outbound", count: 0 };
    }

    // 🔥 기존 데이터 삭제
    await prisma.outboundDailyStat.deleteMany({
      where: { date: targetDate },
    });

    // 🔥 재생성
    await prisma.outboundDailyStat.createMany({
      data: rows.map((r) => ({
        date: targetDate,
        material_id: r.material_id,
        total_qty: Number(r._sum.quantity ?? 0),
        total_sales: Number(r._sum.sale_amount ?? 0),
        total_cost: Number(r._sum.cost_amount ?? 0),
        total_profit: Number(r._sum.profit ?? 0),
      })),
    });

    return {
      type: "outbound",
      count: rows.length,
    };
  }

  // ==============================
  // 반품 일별 통계
  // ==============================
  /**
   * 지정일 기준 반품 일별 통계(ReturnDailyStat) 재생성
   */
  async createReturnDailyStat(date = null) {
    const { start, end, target } = this.getDateRange(date);

    const startDate = dayjs(target).startOf("day").toDate();
    const endDate = dayjs(target).endOf("day").toDate();

    const targetDate = new Date(
      Date.UTC(
        dayjs(target).year(),
        dayjs(target).month(),
        dayjs(target).date(),
      ),
    );

    const rows = await prisma.returnOrderItem.groupBy({
      by: ["material_id"],
      _sum: {
        quantity: true,
        sale_amount: true,
        cost_amount: true,
        profit: true,
      },
      where: {
        returnOrder: {
          created_at: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
    });

    if (!rows.length) {
      return { type: "return", count: 0 };
    }

    // 🔥 기존 데이터 삭제
    await prisma.returnDailyStat.deleteMany({
      where: { date: targetDate },
    });

    // 🔥 재생성
    await prisma.returnDailyStat.createMany({
      data: rows.map((r) => ({
        date: targetDate,
        material_id: r.material_id,
        total_qty: Number(r._sum.quantity ?? 0),
        total_sales: Number(r._sum.sale_amount ?? 0),
        total_cost: Number(r._sum.cost_amount ?? 0),
        total_profit: Number(r._sum.profit ?? 0),
      })),
    });

    return {
      type: "return",
      count: rows.length,
    };
  }

  // ==============================
  // 재고 스냅샷
  // ==============================
  /**
   * 지정일 기준 재고 일별 스냅샷(StockDailySnapshot) 재생성
   * Stock 을 자재×창고 단위로 groupBy 해 수량 합계 저장
   * (location/shelf 는 합산 대상 아님)
   */
  async createStockDailyStat(date = null) {
    const { target } = this.getDateRange(date);

    // 🔥 날짜 UTC 고정 (DATE 컬럼 대응)
    const targetDate = new Date(
      Date.UTC(
        dayjs(target).year(),
        dayjs(target).month(),
        dayjs(target).date(),
      ),
    );

    // 🔥 location 제거 → warehouse 단위 합산
    const stocks = await prisma.stock.groupBy({
      by: ["material_id", "warehouse_id"],
      _sum: {
        quantity: true,
      },
    });

    if (!stocks.length) {
      return { type: "stock", count: 0 };
    }

    // 🔥 기존 데이터 삭제 (해당 날짜 전체 초기화)
    await prisma.stockDailySnapshot.deleteMany({
      where: { date: targetDate },
    });

    // 🔥 재생성 (중복 없음 보장)
    await prisma.stockDailySnapshot.createMany({
      data: stocks.map((s) => ({
        date: targetDate,
        material_id: s.material_id,
        warehouse_id: s.warehouse_id,
        quantity: s._sum.quantity || 0,
      })),
    });

    return {
      type: "stock",
      count: stocks.length,
    };
  }

  // ==============================
  // 차트용
  // ==============================

  /** 입고 차트 데이터 (일자별 total_qty / total_cost) */
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

  /** 출고 차트 데이터 (수량/원가/매출/이익 일자별 합계) */
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

  /** 반품 차트 데이터 (수량/원가/매출/이익 일자별 합계) */
  async returnDailyTotalAmount(data) {
    const where = this.buildDateWhere(data);

    const rows = await prisma.returnDailyStat.groupBy({
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

  /** 재고 차트 데이터 (일자별 총 수량) */
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
