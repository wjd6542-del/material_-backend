import stockService from "../services/stock.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
  transferSchema,
} from "../validators/stock.schema.js";

/**
 * 재고(Stock) 라우트 (/api/stock/*)
 * 자재×창고×위치×선반 단위 실시간 재고 조회/이동/이력 제공
 */
export default async function stockRoutes(app) {
  /**
   * 재고 전체 리스트 (필터 없음)
   * @route POST /api/stock/allList
   */
  app.post("/allList", async (req) => {
    return stockService.getAllList(req.body);
  });

  /**
   * 재고 리스트 (자재/창고/위치/기간/스캔코드 필터 + QR 코드 포함)
   * @route POST /api/stock/list
   */
  app.post("/list", async (req) => {
    return stockService.getList(req.body);
  });

  /**
   * 총 재고 건수·수량 요약 (대시보드용)
   * @route POST /api/stock/stockSummary
   */
  app.post("/stockSummary", async (req) => {
    return stockService.stockSummary(req.body);
  });

  /**
   * 안전재고 미달 자재 TOP N (기본 10건)
   * @route POST /api/stock/lowStockMaterials
   */
  app.post("/lowStockMaterials", async (req) => {
    return stockService.getLowStockMaterials(req.body);
  });

  /**
   * 재고 단건 상세 조회
   * @route POST /api/stock/:id
   */
  app.post("/:id", async (req) => {
    const params = validate(idParamSchema, req.params);
    return stockService.getById(params.id);
  });

  /**
   * 재고 변동 이력(StockHistory) 리스트 조회
   * @route POST /api/stock/detailList
   */
  app.post("/detailList", async (req) => {
    return stockService.getDetailList(req.body);
  });

  /**
   * 창고(랙) 기준 자재 재고 집계 (도면 표시용 points/rotation 포함)
   * @route POST /api/stock/warehousStock
   */
  app.post("/warehousStock", async (req) => {
    return stockService.warehousStock(req.body);
  });

  /**
   * 위치(Location) 기준 자재 재고 집계
   * @route POST /api/stock/locationStock
   */
  app.post("/locationStock", async (req) => {
    return stockService.locationStock(req.body);
  });

  /**
   * 선반(Shelf) 기준 자재 재고 집계 (좌표/크기 포함)
   * @route POST /api/stock/shelfStock
   */
  app.post("/shelfStock", async (req) => {
    return stockService.shelfStock(req.body);
  });

  /**
   * 창고/위치 간 재고 이동 (TRANSFER_OUT + TRANSFER_IN 이력 동시 기록 + 알림)
   * @route POST /api/stock/transfer
   */
  app.post("/transfer", async (req) => {
    const body = validate(transferSchema, req.body);
    return stockService.transfer(body, req.user);
  });
}
