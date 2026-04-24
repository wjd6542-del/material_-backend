import categoryService from "../services/category.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/category.schema.js";
import { permission } from "../middleware/permission.js";

/**
 * 자재 카테고리(MaterialCategory) 라우트 (/api/category/*)
 * 자재 분류 트리(parent/child + path/depth 관리) CRUD
 */
export default async function categoryRoutes(app) {
  /** 카테고리 전체 리스트 @route POST /api/category/allList */
  app.post(
    "/allList",
    { preHandler: permission("material.category.view") },
    async (req) => {
      return categoryService.getAllList(req.body);
    },
  );

  /** 카테고리 트리 구조 조회 @route POST /api/category/getCategoryTree */
  app.post(
    "/getCategoryTree",
    { preHandler: permission("material.category.view") },
    async () => {
      return categoryService.getCategoryTree();
    },
  );

  /** 카테고리 리스트 조회 @route POST /api/category/list */
  app.post(
    "/list",
    { preHandler: permission("material.category.view") },
    async (req) => {
      return categoryService.getList(req.body);
    },
  );

  /** 카테고리 키 기준 그룹핑 조회 @route POST /api/category/keyGroup */
  app.post(
    "/keyGroup",
    { preHandler: permission("material.category.view") },
    async (req) => {
      return categoryService.getKeyGroup(req.body);
    },
  );

  /** 카테고리 단건 조회 @route GET /api/category/:id */
  app.get(
    "/:id",
    { preHandler: permission("material.category.view") },
    async (req) => {
      const params = validate(idParamSchema, req.params);
      return categoryService.getById(params.id);
    },
  );

  /** 카테고리 단건 삭제 @route POST /api/category/delete */
  app.post(
    "/delete",
    { preHandler: permission("material.delete") },
    async (req) => {
      const params = validate(idParamSchema, req.body);
      return categoryService.deleteById(params.id);
    },
  );

  /** 카테고리 저장 @route POST /api/category/save */
  app.post(
    "/save",
    { preHandler: permission("material.update") },
    async (req) => {
      const body = validate(batchSaveSchema, req.body);
      return categoryService.batchSave(body);
    },
  );

  /** 카테고리 트리 일괄 저장 @route POST /api/category/batchSave */
  app.post(
    "/batchSave",
    { preHandler: permission("material.update") },
    async (req) => {
      const body = validate(batchSaveSchema, req.body);
      return categoryService.batchSave(body);
    },
  );

  /** 카테고리 일괄 삭제 @route POST /api/category/batchDelete */
  app.post(
    "/batchDelete",
    { preHandler: permission("material.delete") },
    async (req) => {
      const body = validate(batchDeleteSchema, req.body);
      return categoryService.batchDelete(body);
    },
  );
}
