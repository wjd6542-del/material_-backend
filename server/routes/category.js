import categoryService from "../services/category.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/category.schema.js";

/**
 * 자재 카테고리(MaterialCategory) 라우트 (/api/category/*)
 * 자재 분류 트리(parent/child + path/depth 관리) CRUD
 */
export default async function categoryRoutes(app) {
  /** 카테고리 전체 리스트 @route POST /api/category/allList */
  app.post("/allList", async (req) => {
    return categoryService.getAllList(req.body);
  });

  /** 카테고리 트리 구조 조회 (children 재귀 포함) @route POST /api/category/getCategoryTree */
  app.post("/getCategoryTree", async () => {
    return categoryService.getCategoryTree();
  });

  /** 카테고리 리스트 조회 @route POST /api/category/list */
  app.post("/list", async (req) => {
    return categoryService.getList(req.body);
  });

  /** 카테고리 키 기준 그룹핑 조회 @route POST /api/category/keyGroup */
  app.post("/keyGroup", async (req) => {
    return categoryService.getKeyGroup(req.body);
  });

  /** 카테고리 단건 조회 @route GET /api/category/:id */
  app.get("/:id", async (req) => {
    const params = validate(idParamSchema, req.params);
    return categoryService.getById(params.id);
  });

  /** 카테고리 단건 삭제 (하위 노드 체크) @route POST /api/category/delete */
  app.post("/delete", async (req) => {
    const params = validate(idParamSchema, req.body);
    return categoryService.deleteById(params.id);
  });

  /** 카테고리 저장 (트리 루트/하위 노드 동시 upsert) @route POST /api/category/save */
  app.post("/save", async (req) => {
    const body = validate(batchSaveSchema, req.body);
    return categoryService.batchSave(body);
  });

  /** 카테고리 트리 일괄 저장 (path·depth 재계산) @route POST /api/category/batchSave */
  app.post("/batchSave", async (req) => {
    const body = validate(batchSaveSchema, req.body);
    return categoryService.batchSave(body);
  });

  /** 카테고리 일괄 삭제 @route POST /api/category/batchDelete */
  app.post("/batchDelete", async (req) => {
    const body = validate(batchDeleteSchema, req.body);
    return categoryService.batchDelete(body);
  });
}
