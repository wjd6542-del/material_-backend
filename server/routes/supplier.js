import supplierService from "../services/supplier.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
  historyListSchema,
} from "../validators/supplier.schema.js";
import { permission } from "../middleware/permission.js";

/**
 * 공급업체(Supplier) 라우트 (/api/supplier/*)
 * 공급/거래처 정보 CRUD (입고·출고 아이템과 연결)
 */
export default async function supplierRoutes(app) {
  /** 공급업체 전체 리스트 @route POST /api/supplier/allList */
  app.post(
    "/allList",
    { preHandler: permission("supplier.view") },
    async (req) => {
      return supplierService.getAllList(req.body);
    },
  );

  /** 공급업체 리스트 @route POST /api/supplier/list */
  app.post(
    "/list",
    { preHandler: permission("supplier.view") },
    async (req) => {
      return supplierService.getList(req.body);
    },
  );

  /** 공급업체 단건 조회 @route GET /api/supplier/:id */
  app.get(
    "/:id",
    { preHandler: permission("supplier.view") },
    async (req) => {
      const params = validate(idParamSchema, req.params);
      return supplierService.getById(params.id);
    },
  );

  /** 공급업체 단건 삭제 @route POST /api/supplier/delete */
  app.post(
    "/delete",
    { preHandler: permission("supplier.delete") },
    async (req) => {
      const params = validate(idParamSchema, req.body);
      return supplierService.deleteById(params.id);
    },
  );

  /** 공급업체 생성/수정 @route POST /api/supplier/save */
  app.post(
    "/save",
    { preHandler: permission("supplier.update") },
    async (req) => {
      const body = validate(saveSchema, req.body);
      return supplierService.save(body, req.user);
    },
  );

  /** 공급업체 일괄 저장 @route POST /api/supplier/batchSave */
  app.post(
    "/batchSave",
    { preHandler: permission("supplier.update") },
    async (req) => {
      const body = validate(batchSaveSchema, req.body);
      return supplierService.batchSave(body, req.user);
    },
  );

  /** 공급업체 일괄 삭제 @route POST /api/supplier/batchDelete */
  app.post(
    "/batchDelete",
    { preHandler: permission("supplier.delete") },
    async (req) => {
      const body = validate(batchDeleteSchema, req.body);
      return supplierService.batchDelete(body);
    },
  );

  /** 거래처 변경 이력 리스트 @route POST /api/supplier/history */
  app.post(
    "/history",
    { preHandler: permission("supplier.view") },
    async (req) => {
      const body = validate(historyListSchema, req.body);
      return supplierService.getHistory(body);
    },
  );
}
