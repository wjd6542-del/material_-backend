import shelfService from "../services/shelf.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/shelf.schema.js";
import { permission } from "../middleware/permission.js";
import { setActiveSchema } from "../validators/setActive.schema.js";

/**
 * 선반(Shelf) 라우트 (/api/shelf/*)
 * 위치 내 세부 적재 선반 CRUD (도면 x,y,width,height 포함)
 */
export default async function shelfRoutes(app) {
  /** 선반 전체 리스트 @route POST /api/shelf/allList */
  app.post(
    "/allList",
    { preHandler: permission("warehouse.shelf.view") },
    async (req) => {
      return shelfService.getAllList(req.body);
    },
  );

  /** 선반 리스트 @route POST /api/shelf/list */
  app.post(
    "/list",
    { preHandler: permission("warehouse.shelf.view") },
    async (req) => {
      return shelfService.getList(req.body);
    },
  );

  /** 선반 단건 조회 @route GET /api/shelf/:id */
  app.get(
    "/:id",
    { preHandler: permission("warehouse.shelf.view") },
    async (req) => {
      const params = validate(idParamSchema, req.params);
      return shelfService.getById(params.id);
    },
  );

  /** 선반 단건 삭제 @route POST /api/shelf/delete */
  app.post(
    "/delete",
    { preHandler: permission("warehouse.shelf.delete") },
    async (req) => {
      const params = validate(idParamSchema, req.body);
      return shelfService.deleteById(params.id);
    },
  );

  /** 선반 생성/수정 @route POST /api/shelf/save */
  app.post(
    "/save",
    { preHandler: permission("warehouse.shelf.update") },
    async (req) => {
      const body = validate(saveSchema, req.body);
      return shelfService.save(body);
    },
  );

  /** 선반 일괄 저장 @route POST /api/shelf/batchSave */
  app.post(
    "/batchSave",
    { preHandler: permission("warehouse.shelf.update") },
    async (req) => {
      const body = validate(batchSaveSchema, req.body);
      return shelfService.batchSave(body);
    },
  );

  /** 선반 일괄 삭제 @route POST /api/shelf/batchDelete */
  app.post(
    "/batchDelete",
    { preHandler: permission("warehouse.shelf.delete") },
    async (req) => {
      const body = validate(batchDeleteSchema, req.body);
      return shelfService.batchDelete(body);
    },
  );

  /** shelf 활성/비활성 토글 @route POST /api/shelf/setActive */
  app.post(
    "/setActive",
    { preHandler: permission("warehouse.shelf.update") },
    async (req) => {
      const body = validate(setActiveSchema, req.body);
      return shelfService.setActive(body, req.user);
    },
  );
}
