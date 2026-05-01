import businessService from "../services/business.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/business.schema.js";
import { permission } from "../middleware/permission.js";
import { setActiveSchema } from "../validators/setActive.schema.js";

/**
 * 사업자(Business) 라우트 (/api/business/*)
 * 사업자 정보 CRUD
 */
export default async function businessRoutes(app) {
  /** 사업자 전체 리스트 @route POST /api/business/allList */
  app.post(
    "/allList",
    { preHandler: permission("business.view") },
    async (req) => {
      return businessService.getAllList(req.body);
    },
  );

  /** 사업자 대표 정보 @route POST /api/business/info */
  app.post(
    "/info",
    { preHandler: permission("business.view") },
    async () => {
      return businessService.getInfo();
    },
  );

  /** 사업자 리스트 @route POST /api/business/list */
  app.post(
    "/list",
    { preHandler: permission("business.view") },
    async (req) => {
      return businessService.getList(req.body);
    },
  );

  /** 사업자 단건 조회 @route GET /api/business/:id */
  app.get(
    "/:id",
    { preHandler: permission("business.view") },
    async (req) => {
      const params = validate(idParamSchema, req.params);
      return businessService.getById(params.id);
    },
  );

  /** 사업자 단건 삭제 @route POST /api/business/delete */
  app.post(
    "/delete",
    { preHandler: permission("business.update") },
    async (req) => {
      const params = validate(idParamSchema, req.body);
      return businessService.deleteById(params.id);
    },
  );

  /** 사업자 생성/수정 @route POST /api/business/save */
  app.post(
    "/save",
    { preHandler: permission("business.update") },
    async (req) => {
      const body = validate(saveSchema, req.body);
      return businessService.save(body);
    },
  );

  /** 사업자 일괄 저장 @route POST /api/business/batchSave */
  app.post(
    "/batchSave",
    { preHandler: permission("business.update") },
    async (req) => {
      const body = validate(batchSaveSchema, req.body);
      return businessService.batchSave(body);
    },
  );

  /** 사업자 일괄 삭제 @route POST /api/business/batchDelete */
  app.post(
    "/batchDelete",
    { preHandler: permission("business.update") },
    async (req) => {
      const body = validate(batchDeleteSchema, req.body);
      return businessService.batchDelete(body);
    },
  );

  /** business 활성/비활성 토글 @route POST /api/business/setActive */
  app.post(
    "/setActive",
    { preHandler: permission("business.update") },
    async (req) => {
      const body = validate(setActiveSchema, req.body);
      return businessService.setActive(body, req.user);
    },
  );
}
