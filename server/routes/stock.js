import stockService from "../services/stock.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
  transferSchema,
} from "../validators/stock.schema.js";

export default async function stockRoutes(app) {
  app.post("/allList", async (req) => {
    return stockService.getAllList(req.body);
  });

  // 재고 리스트
  app.post("/list", async (req) => {
    return stockService.getList(req.body);
  });

  app.post("/stockSummary", async (req) => {
    return stockService.stockSummary(req.body);
  });

  // 안전재고 부족 자재 리스트
  app.post("/lowStockMaterials", async (req) => {
    return stockService.getLowStockMaterials(req.body);
  });

  app.post("/:id", async (req) => {
    const params = validate(idParamSchema, req.params);
    return stockService.getById(params.id);
  });

  // 히스토리 정보
  app.post("/detailList", async (req) => {
    return stockService.getDetailList(req.body);
  });

  // 창고대비 자재 목록 조회
  app.post("/warehousStock", async (req) => {
    return stockService.warehousStock(req.body);
  });

  // 창고대비 자재 목록 조회
  app.post("/locationStock", async (req) => {
    return stockService.locationStock(req.body);
  });

  // 재고 이동 처리
  app.post("/transfer", async (req) => {
    const body = validate(transferSchema, req.body);
    return stockService.transfer(body, req.user);
  });
}
