import shelfService from "../services/shelf.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/shelf.schema.js";

export default async function shelfRoutes(app) {
  app.post("/allList", async (req) => {
    return shelfService.getAllList(req.body);
  });

  app.post("/list", async (req) => {
    return shelfService.getList(req.body);
  });

  app.get("/:id", async (req) => {
    const params = validate(idParamSchema, req.params);
    return shelfService.getById(params.id);
  });

  app.post("/delete", async (req) => {
    const params = validate(idParamSchema, req.body);
    return shelfService.deleteById(params.id);
  });

  app.post("/save", async (req) => {
    const body = validate(saveSchema, req.body);
    return shelfService.save(body);
  });

  // 일괄 저장
  app.post("/batchSave", async (req) => {
    const body = validate(batchSaveSchema, req.body);
    return shelfService.batchSave(body);
  });

  // 일괄 삭제
  app.post("/batchDelete", async (req) => {
    const body = validate(batchDeleteSchema, req.body);
    return shelfService.batchDelete(body);
  });
}
