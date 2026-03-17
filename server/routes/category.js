import categoryService from "../services/category.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/category.schema.js";

export default async function categoryRoutes(app) {
  app.post("/allList", async (req) => {
    return categoryService.getAllList(req.body);
  });

  app.post("/list", async (req) => {
    return categoryService.getList(req.body);
  });

  app.post("/keyGroup", async (req) => {
    return categoryService.getKeyGroup(req.body);
  });

  app.get("/:id", async (req) => {
    const params = validate(idParamSchema, req.params);
    return categoryService.getById(params.id);
  });

  app.post("/delete", async (req) => {
    const params = validate(idParamSchema, req.body);
    return categoryService.deleteById(params.id);
  });

  app.post("/save", async (req) => {
    const body = validate(saveSchema, req.body);
    return categoryService.save(body);
  });

  // 일괄 저장
  app.post("/batchSave", async (req) => {
    const body = validate(batchSaveSchema, req.body);
    return categoryService.batchSave(body);
  });

  // 일괄 삭제
  app.post("/batchDelete", async (req) => {
    const body = validate(batchDeleteSchema, req.body);
    return categoryService.batchDelete(body);
  });
}
