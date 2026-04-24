import stockService from "../services/stock.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
  transferSchema,
} from "../validators/stock.schema.js";
import { permission } from "../middleware/permission.js";

/**
 * 재고(Stock) 라우트 (/api/stock/*)
 * 자재×창고×위치×선반 단위 실시간 재고 조회/이동/이력 제공
 */
export default async function stockRoutes(app) {
  /** 재고 전체 리스트 @route POST /api/stock/allList */
  app.post(
    "/allList",
    { preHandler: permission("stock.view") },
    async (req) => {
      return stockService.getAllList(req.body);
    },
  );

  /** 재고 리스트 @route POST /api/stock/list */
  app.post("/list", { preHandler: permission("stock.view") }, async (req) => {
    return stockService.getList(req.body);
  });

  /** 재고 요약 (대시보드) @route POST /api/stock/stockSummary */
  app.post(
    "/stockSummary",
    { preHandler: permission("dashboard.view") },
    async (req) => {
      return stockService.stockSummary(req.body);
    },
  );

  /** 안전재고 미달 자재 (대시보드) @route POST /api/stock/lowStockMaterials */
  app.post(
    "/lowStockMaterials",
    { preHandler: permission("dashboard.view") },
    async (req) => {
      return stockService.getLowStockMaterials(req.body);
    },
  );

  /** 재고 단건 상세 @route POST /api/stock/:id */
  app.post("/:id", { preHandler: permission("stock.view") }, async (req) => {
    const params = validate(idParamSchema, req.params);
    return stockService.getById(params.id);
  });

  /** 재고 변동 이력 리스트 @route POST /api/stock/detailList */
  app.post(
    "/detailList",
    { preHandler: permission("stock.detail.view") },
    async (req) => {
      return stockService.getDetailList(req.body);
    },
  );

  /** 창고 기준 재고 집계 @route POST /api/stock/warehousStock */
  app.post(
    "/warehousStock",
    { preHandler: permission("stock.warehouse.view") },
    async (req) => {
      return stockService.warehousStock(req.body);
    },
  );

  /** 위치 기준 재고 집계 @route POST /api/stock/locationStock */
  app.post(
    "/locationStock",
    { preHandler: permission("stock.location.view") },
    async (req) => {
      return stockService.locationStock(req.body);
    },
  );

  /** 선반 기준 재고 집계 @route POST /api/stock/shelfStock */
  app.post(
    "/shelfStock",
    { preHandler: permission("stock.shelf.view") },
    async (req) => {
      return stockService.shelfStock(req.body);
    },
  );

  /** 창고/위치 간 재고 이동 @route POST /api/stock/transfer */
  app.post(
    "/transfer",
    { preHandler: permission("stock.move.create") },
    async (req) => {
      const body = validate(transferSchema, req.body);
      return stockService.transfer(body, req.user);
    },
  );
}
