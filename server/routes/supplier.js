import supplierService from "../services/supplier.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/supplier.schema.js";

export default async function supplierRoutes(app) {
  app.post("/allList", async (req) => {
    return supplierService.getAllList(req.body);
  });

  app.post("/list", async (req) => {
    return supplierService.getList(req.body);
  });

  app.get("/:id", async (req) => {
    const params = validate(idParamSchema, req.params);
    return supplierService.getById(params.id);
  });

  app.post("/delete", async (req) => {
    const params = validate(idParamSchema, req.body);
    return supplierService.deleteById(params.id);
  });

  app.post("/save", async (req) => {
    const body = validate(saveSchema, req.body);
    return supplierService.save(body);
  });

  // 일괄 저장
  app.post("/batchSave", async (req) => {
    const body = validate(batchSaveSchema, req.body);
    return supplierService.batchSave(body);
  });

  // 일괄 삭제
  app.post("/batchDelete", async (req) => {
    const body = validate(batchDeleteSchema, req.body);
    return supplierService.batchDelete(body);
  });
}
