import tagService from "../services/tag.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/tag.schema.js";

/**
 * 태그(Tag) 라우트 (/api/tag/*)
 * 태그 마스터 CRUD + 품목-태그 매핑 동기화
 */
export default async function tagRoutes(app) {
  /** 태그 전체 리스트 @route POST /api/tag/allList */
  app.post("/allList", async (req) => {
    return tagService.getAllList(req.body);
  });

  /** 태그 리스트 (필터) @route POST /api/tag/list */
  app.post("/list", async (req) => {
    return tagService.getList(req.body);
  });

  /** 태그 단건 조회 @route GET /api/tag/:id */
  app.get("/:id", async (req) => {
    const params = validate(idParamSchema, req.params);
    return tagService.getById(params.id);
  });

  /** 태그 단건 삭제 (관련 MaterialTag cascade) @route POST /api/tag/delete */
  app.post("/delete", async (req) => {
    const params = validate(idParamSchema, req.body);
    return tagService.deleteById(params.id);
  });

  /** 태그 생성/수정 (name 고유) @route POST /api/tag/save */
  app.post("/save", async (req) => {
    const body = validate(saveSchema, req.body);
    return tagService.save(body);
  });

  /** 태그 일괄 저장 @route POST /api/tag/batchSave */
  app.post("/batchSave", async (req) => {
    const body = validate(batchSaveSchema, req.body);
    return tagService.batchSave(body);
  });

  /** 태그 일괄 삭제 @route POST /api/tag/batchDelete */
  app.post("/batchDelete", async (req) => {
    const body = validate(batchDeleteSchema, req.body);
    return tagService.batchDelete(body);
  });
}
