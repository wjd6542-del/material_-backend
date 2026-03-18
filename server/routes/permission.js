import permissionService from "../services/permission.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/permission.schema.js";

export default async function permissionRoutes(app) {
  app.post("/allList", async (req) => {
    return permissionService.getAllList(req.body);
  });

  app.post("/list", async (req) => {
    return permissionService.getList(req.body);
  });

  app.post("/keyGroup", async (req) => {
    return permissionService.getKeyGroup(req.body);
  });

  app.get("/:id", async (req) => {
    const params = validate(idParamSchema, req.params);
    return permissionService.getById(params.id);
  });

  app.post("/delete", async (req) => {
    const params = validate(idParamSchema, req.body);
    return permissionService.deleteById(params.id);
  });

  app.post("/save", async (req) => {
    const body = validate(saveSchema, req.body);
    return permissionService.save(body);
  });

  // 일괄 저장
  app.post("/batchSave", async (req) => {
    const body = validate(batchSaveSchema, req.body);
    return permissionService.batchSave(body);
  });

  // 일괄 삭제
  app.post("/batchDelete", async (req) => {
    const body = validate(batchDeleteSchema, req.body);
    return permissionService.batchDelete(body);
  });
}
