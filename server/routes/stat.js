import StatService from "../services/stat.service.js";
import { permission } from "../middleware/permission.js";

/**
 * 통계(Stat) 라우트 (/api/stat/*)
 * 입고/출고/반품/재고 일별 통계 집계 및 차트 데이터 제공
 * 일부 엔드포인트는 cron 배치와 동일한 집계 로직을 수동 재실행
 */
export default async function (app) {
  /** 입고 일별 통계 집계 재실행 @route POST /api/stat/inbound/daily */
  app.post(
    "/inbound/daily",
    { preHandler: permission("statistics.inbound.view") },
    async (req) => {
      const date = req.body.date ?? null;
      return StatService.createInboundDailyStat(date);
    },
  );

  /** 출고 일별 통계 집계 재실행 @route POST /api/stat/outbound/daily */
  app.post(
    "/outbound/daily",
    { preHandler: permission("statistics.outbound.view") },
    async (req) => {
      const date = req.body.date ?? null;
      return StatService.createOutboundDailyStat(date);
    },
  );

  /** 반품 일별 통계 집계 재실행 @route POST /api/stat/return/daily */
  app.post(
    "/return/daily",
    { preHandler: permission("statistics.return.view") },
    async (req) => {
      const date = req.body.date ?? null;
      return StatService.createReturnDailyStat(date);
    },
  );

  /** 재고 일별 스냅샷 생성 @route POST /api/stat/stock/daily */
  app.post(
    "/stock/daily",
    { preHandler: permission("statistics.stock.view") },
    async (req) => {
      const date = req.body.date ?? null;
      return StatService.createStockDailyStat(date);
    },
  );

  /** 입고 통계 리스트 @route POST /api/stat/inboundList */
  app.post(
    "/inboundList",
    { preHandler: permission("statistics.inbound.view") },
    async (req) => {
      return await StatService.inboundList(req.body);
    },
  );

  /** 출고 통계 리스트 @route POST /api/stat/outboundList */
  app.post(
    "/outboundList",
    { preHandler: permission("statistics.outbound.view") },
    async (req) => {
      return await StatService.outboundList(req.body);
    },
  );

  /** 반품 통계 리스트 @route POST /api/stat/returnList */
  app.post(
    "/returnList",
    { preHandler: permission("statistics.return.view") },
    async (req) => {
      return await StatService.returnList(req.body);
    },
  );

  /** 재고 스냅샷 리스트 @route POST /api/stat/stockList */
  app.post(
    "/stockList",
    { preHandler: permission("statistics.stock.view") },
    async (req) => {
      return await StatService.stockList(req.body);
    },
  );

  /** 입고 총액 차트 @route POST /api/stat/inbound/daily/totalAmount */
  app.post(
    "/inbound/daily/totalAmount",
    { preHandler: permission("statistics.inbound.view") },
    async (req) => {
      return StatService.inboundDailyTotalAmount(req.body);
    },
  );

  /** 출고 총액 차트 @route POST /api/stat/outbound/daily/totalAmount */
  app.post(
    "/outbound/daily/totalAmount",
    { preHandler: permission("statistics.outbound.view") },
    async (req) => {
      return StatService.outboundDailyTotalAmount(req.body);
    },
  );

  /** 반품 총액 차트 @route POST /api/stat/return/daily/totalAmount */
  app.post(
    "/return/daily/totalAmount",
    { preHandler: permission("statistics.return.view") },
    async (req) => {
      return StatService.returnDailyTotalAmount(req.body);
    },
  );

  /** 재고 총수량 차트 @route POST /api/stat/stock/daily/totalQty */
  app.post(
    "/stock/daily/totalQty",
    { preHandler: permission("statistics.stock.view") },
    async (req) => {
      return StatService.stockDailyTotalQty(req.body);
    },
  );
}
