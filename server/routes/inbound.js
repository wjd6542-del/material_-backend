import inboundService from "../services/inbound.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/inbound.schema.js";

export default async function inboundRoutes(app) {
  app.post("/allList", async (req) => {
    return inboundService.getAllList(req.body);
  });

  app.post("/list", async (req) => {
    return inboundService.getList(req.body);
  });

  app.post("/detail/list", async (req) => {
    return inboundService.detailList(req.body);
  });

  app.post("/:id", async (req) => {
    const params = validate(idParamSchema, req.params);
    return inboundService.getById(params.id);
  });

  app.post("/delete", async (req) => {
    const params = validate(idParamSchema, req.body);
    return inboundService.deleteById(params.id, req.user);
  });

  app.post("/save", async (req) => {
    const user = req.user;
    const body = validate(saveSchema, req.body);
    return inboundService.save(body, user);
  });

  // 일괄 저장
  app.post("/batchSave", async (req) => {
    const body = validate(batchSaveSchema, req.body);
    return inboundService.batchSave(body, req.user);
  });

  // 일괄 삭제
  app.post("/batchDelete", async (req) => {
    const body = validate(batchDeleteSchema, req.body);
    return inboundService.batchDelete(body, req.user);
  });
}
