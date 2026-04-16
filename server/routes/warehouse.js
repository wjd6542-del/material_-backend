import warehouseService from "../services/warehouse.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/warehouse.schema.js";

/**
 * 창고(Warehouse) 라우트 (/api/warehouse/*)
 * 창고 마스터 CRUD (도면 좌표/회전/색상 포함)
 */
export default async function warehouseRoutes(app) {
  /** 창고 전체 리스트 @route POST /api/warehouse/allList */
  app.post("/allList", async (req) => {
    return warehouseService.getAllList(req.body);
  });

  /** 창고 리스트 (key/keys 검색) @route POST /api/warehouse/list */
  app.post("/list", async (req) => {
    return warehouseService.getList(req.body);
  });

  /** 창고 단건 조회 @route GET /api/warehouse/:id */
  app.get("/:id", async (req) => {
    const params = validate(idParamSchema, req.params);
    return warehouseService.getById(params.id);
  });

  /** 창고 단건 삭제 (연관 Location 정리) @route POST /api/warehouse/delete */
  app.post("/delete", async (req) => {
    const params = validate(idParamSchema, req.body);
    return warehouseService.deleteById(params.id);
  });

  /** 창고 생성/수정 (code 중복 체크) @route POST /api/warehouse/save */
  app.post("/save", async (req) => {
    const body = validate(saveSchema, req.body);
    return warehouseService.save(body);
  });

  /** 창고 일괄 저장 @route POST /api/warehouse/batchSave */
  app.post("/batchSave", async (req) => {
    const body = validate(batchSaveSchema, req.body);
    return warehouseService.batchSave(body);
  });

  /** 창고 일괄 삭제 @route POST /api/warehouse/batchDelete */
  app.post("/batchDelete", async (req) => {
    const body = validate(batchDeleteSchema, req.body);
    return warehouseService.batchDelete(body);
  });
}
