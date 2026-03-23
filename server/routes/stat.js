import StatService from "../services/stat.service.js";

export default async function (app) {
  // 입고 일별 통계 생성
  app.post("/inbound/daily", async (req) => {
    const date = req.body.date ?? null;
    return StatService.createInboundDailyStat(date);
  });

  // 출고 일별 통계 생성
  app.post("/outbound/daily", async (req) => {
    const date = req.body.date ?? null;
    return StatService.createOutboundDailyStat(date);
  });

  // 반품 일별 통계 생성
  app.post("/return/daily", async (req) => {
    const date = req.body.date ?? null;
    return StatService.createReturnDailyStat(date);
  });

  // 재고 일별 통계 생성
  app.post("/stock/daily", async (req) => {
    const date = req.body.date ?? null;
    return StatService.createStockDailyStat(date);
  });

  // 입고 통계 리스트
  app.post("/inboundList", async (req) => {
    return await StatService.inboundList(req.body);
  });

  // 출고 통계 리스트
  app.post("/outboundList", async (req) => {
    return await StatService.outboundList(req.body);
  });

  // 반품 통계 리스트
  app.post("/returnList", async (req) => {
    return await StatService.returnList(req.body);
  });

  // 재고 통계 리스트
  app.post("/stockList", async (req) => {
    return await StatService.stockList(req.body);
  });

  // 입고 차트용
  app.post("/inbound/daily/totalAmount", async (req) => {
    return StatService.inboundDailyTotalAmount(req.body);
  });

  // 출고 차트용
  app.post("/outbound/daily/totalAmount", async (req) => {
    return StatService.outboundDailyTotalAmount(req.body);
  });

  // 반품 차트용
  app.post("/return/daily/totalAmount", async (req) => {
    return StatService.returnDailyTotalAmount(req.body);
  });

  // 출고 차트용
  app.post("/stock/daily/totalQty", async (req) => {
    return StatService.stockDailyTotalQty(req.body);
  });
}
