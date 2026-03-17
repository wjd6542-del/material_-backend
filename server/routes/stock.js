import stockService from "../services/stock.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/stock.schema.js";

export default async function stockRoutes(app) {
  app.post("/allList", async (req) => {
    return stockService.getAllList(req.body);
  });

  app.post("/list", async (req) => {
    return stockService.getList(req.body);
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
}
