import roleService from "../services/role.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/role.schema.js";

export default async function roleRoutes(app) {
  app.post("/allList", async (req) => {
    return roleService.getAllList(req.body);
  });

  app.post("/list", async (req) => {
    return roleService.getList(req.body);
  });

  app.get("/:id", async (req) => {
    const params = validate(idParamSchema, req.params);
    return roleService.getById(params.id);
  });

  app.post("/delete", async (req) => {
    const params = validate(idParamSchema, req.body);
    return roleService.deleteById(params.id);
  });

  app.post("/save", async (req) => {
    const body = validate(saveSchema, req.body);
    return roleService.save(body);
  });

  // 일괄 저장
  app.post("/batchSave", async (req) => {
    const body = validate(batchSaveSchema, req.body);
    return roleService.batchSave(body);
  });

  // 일괄 삭제
  app.post("/batchDelete", async (req) => {
    const body = validate(batchDeleteSchema, req.body);
    return roleService.batchDelete(body);
  });
}
