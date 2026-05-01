import warehouseService from "../services/warehouse.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/warehouse.schema.js";
import { permission } from "../middleware/permission.js";
import { setActiveSchema } from "../validators/setActive.schema.js";

/**
 * 창고(Warehouse) 라우트 (/api/warehouse/*)
 * 창고 마스터 CRUD (도면 좌표/회전/색상 포함)
 */
export default async function warehouseRoutes(app) {
  /** 창고 전체 리스트 @route POST /api/warehouse/allList */
  app.post(
    "/allList",
    { preHandler: permission("warehouse.house.view") },
    async (req) => {
      return warehouseService.getAllList(req.body);
    },
  );

  /** 창고 리스트 @route POST /api/warehouse/list */
  app.post(
    "/list",
    { preHandler: permission("warehouse.house.view") },
    async (req) => {
      return warehouseService.getList(req.body);
    },
  );

  /** 창고 단건 조회 @route GET /api/warehouse/:id */
  app.get(
    "/:id",
    { preHandler: permission("warehouse.house.view") },
    async (req) => {
      const params = validate(idParamSchema, req.params);
      return warehouseService.getById(params.id);
    },
  );

  /** 창고 단건 삭제 @route POST /api/warehouse/delete */
  app.post(
    "/delete",
    { preHandler: permission("warehouse.house.delete") },
    async (req) => {
      const params = validate(idParamSchema, req.body);
      return warehouseService.deleteById(params.id);
    },
  );

  /** 창고 생성/수정 @route POST /api/warehouse/save */
  app.post(
    "/save",
    { preHandler: permission("warehouse.house.update") },
    async (req) => {
      const body = validate(saveSchema, req.body);
      return warehouseService.save(body);
    },
  );

  /** 창고 일괄 저장 @route POST /api/warehouse/batchSave */
  app.post(
    "/batchSave",
    { preHandler: permission("warehouse.house.update") },
    async (req) => {
      const body = validate(batchSaveSchema, req.body);
      return warehouseService.batchSave(body);
    },
  );

  /** 창고 일괄 삭제 @route POST /api/warehouse/batchDelete */
  app.post(
    "/batchDelete",
    { preHandler: permission("warehouse.house.delete") },
    async (req) => {
      const body = validate(batchDeleteSchema, req.body);
      return warehouseService.batchDelete(body);
    },
  );

  /** warehouse 활성/비활성 토글 @route POST /api/warehouse/setActive */
  app.post(
    "/setActive",
    { preHandler: permission("warehouse.house.update") },
    async (req) => {
      const body = validate(setActiveSchema, req.body);
      return warehouseService.setActive(body, req.user);
    },
  );
}
