import roleService from "../services/role.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
  permissionSaveSchema,
} from "../validators/role.schema.js";

/**
 * 역할(Role) 라우트 (/api/role/*)
 * 역할 CRUD + 역할-권한 매핑(RolePermission) 동기화
 */
export default async function roleRoutes(app) {
  /** 역할 전체 리스트 @route POST /api/role/allList */
  app.post("/allList", async (req) => {
    return roleService.getAllList(req.body);
  });

  /** 역할 리스트 @route POST /api/role/list */
  app.post("/list", async (req) => {
    return roleService.getList(req.body);
  });

  /** 역할 단건 조회 (포함 권한 코드) @route POST /api/role/:id */
  app.post("/:id", async (req) => {
    const params = validate(idParamSchema, req.params);
    return roleService.getById(params.id);
  });

  /** 역할 단건 삭제 @route POST /api/role/delete */
  app.post("/delete", async (req) => {
    const params = validate(idParamSchema, req.body);
    return roleService.deleteById(params.id);
  });

  /** 역할 생성/수정 @route POST /api/role/save */
  app.post("/save", async (req) => {
    const body = validate(saveSchema, req.body);
    return roleService.save(body);
  });

  /** 역할 일괄 저장 @route POST /api/role/batchSave */
  app.post("/batchSave", async (req) => {
    const body = validate(batchSaveSchema, req.body);
    return roleService.batchSave(body);
  });

  /** 역할 일괄 삭제 @route POST /api/role/batchDelete */
  app.post("/batchDelete", async (req) => {
    const body = validate(batchDeleteSchema, req.body);
    return roleService.batchDelete(body);
  });

  /** 역할에 권한 매핑 동기화 (기존 매핑 제거 후 재생성) @route POST /api/role/permissionSave */
  app.post("/permissionSave", async (req) => {
    const body = validate(permissionSaveSchema, req.body);
    return roleService.permissionSave(body);
  });
}
