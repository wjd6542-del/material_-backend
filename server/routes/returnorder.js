import returnorderService from "../services/returnorder.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/returnorder.schema.js";

export default async function returnorderRoutes(app) {
  app.post("/allList", async (req) => {
    return returnorderService.getAllList(req.body);
  });

  app.post("/list", async (req) => {
    return returnorderService.getList(req.body);
  });

  app.post("/boardCount", async (req) => {
    return returnorderService.boardCount(req.body);
  });

  app.post("/detail/list", async (req) => {
    return returnorderService.detailList(req.body);
  });

  app.post("/:id", async (req) => {
    const params = validate(idParamSchema, req.params);
    return returnorderService.getById(params.id);
  });

  app.post("/delete", async (req) => {
    const params = validate(idParamSchema, req.body);
    return returnorderService.deleteById(params.id);
  });

  app.post("/save", async (req) => {
    const user = req.user;
    const body = validate(saveSchema, req.body);
    return returnorderService.save(body, user);
  });

  // 일괄 삭제
  app.post("/batchDelete", async (req) => {
    const body = validate(batchDeleteSchema, req.body);
    return returnorderService.batchDelete(body);
  });
}
