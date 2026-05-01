import locationService from "../services/location.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/location.schema.js";
import { permission } from "../middleware/permission.js";
import { setActiveSchema } from "../validators/setActive.schema.js";

/**
 * 위치(Location) 라우트 (/api/location/*)
 * 창고 내 구역/열 단위 위치 CRUD (도면 좌표 지원)
 */
export default async function locationRoutes(app) {
  /** 위치 전체 리스트 @route POST /api/location/allList */
  app.post(
    "/allList",
    { preHandler: permission("warehouse.location.view") },
    async (req) => {
      return locationService.getAllList(req.body);
    },
  );

  /** 위치 리스트 @route POST /api/location/list */
  app.post(
    "/list",
    { preHandler: permission("warehouse.location.view") },
    async (req) => {
      return locationService.getList(req.body);
    },
  );

  /** 위치 단건 조회 @route GET /api/location/:id */
  app.get(
    "/:id",
    { preHandler: permission("warehouse.location.view") },
    async (req) => {
      const params = validate(idParamSchema, req.params);
      return locationService.getById(params.id);
    },
  );

  /** 위치 단건 삭제 @route POST /api/location/delete */
  app.post(
    "/delete",
    { preHandler: permission("warehouse.location.delete") },
    async (req) => {
      const params = validate(idParamSchema, req.body);
      return locationService.deleteById(params.id);
    },
  );

  /** 위치 생성/수정 @route POST /api/location/save */
  app.post(
    "/save",
    { preHandler: permission("warehouse.location.update") },
    async (req) => {
      const body = validate(saveSchema, req.body);
      return locationService.save(body);
    },
  );

  /** 위치 일괄 저장 @route POST /api/location/batchSave */
  app.post(
    "/batchSave",
    { preHandler: permission("warehouse.location.update") },
    async (req) => {
      const body = validate(batchSaveSchema, req.body);
      return locationService.batchSave(body);
    },
  );

  /** 위치 일괄 삭제 @route POST /api/location/batchDelete */
  app.post(
    "/batchDelete",
    { preHandler: permission("warehouse.location.delete") },
    async (req) => {
      const body = validate(batchDeleteSchema, req.body);
      return locationService.batchDelete(body);
    },
  );

  /** location 활성/비활성 토글 @route POST /api/location/setActive */
  app.post(
    "/setActive",
    { preHandler: permission("warehouse.location.update") },
    async (req) => {
      const body = validate(setActiveSchema, req.body);
      return locationService.setActive(body, req.user);
    },
  );
}
