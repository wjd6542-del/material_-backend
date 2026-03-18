import materialService from "../services/material.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { parseMultipart } from "../plugins/parseMultipart.plugin.js";

import {
  idParamSchema,
  saveSchema,
  updateSchema,
  batchDeleteSchema,
} from "../validators/material.schema.js";

export default async function materialRoutes(app) {
  app.post("/list", async (req) => {
    return materialService.getList(req.body, req.user);
  });

  app.post("/pageList", async (req) => {
    return materialService.getPageList(req.body, req.user);
  });

  app.post("/newMonthMaterial", async (req) => {
    return materialService.newMonthMaterial(req.body);
  });

  app.post("/:id", async (req) => {
    const params = validate(idParamSchema, req.body);
    return materialService.getById(params.id, req.user);
  });

  // 삭제
  app.post("/delete", async (req) => {
    const params = validate(idParamSchema, req.body);
    return materialService.deleteById(params.id, req.user);
  });

  // 삭제
  app.post("/batchDelete", async (req) => {
    const body = validate(batchDeleteSchema, req.body);
    return materialService.batchDelete(body, req.user);
  });

  // 저장
  app.post("/save", async (req) => {
    const { fields, files } = await parseMultipart(req);
    const body = validate(saveSchema, fields);
    return await materialService.save(body, files, req.user);
  });

  // 수정
  app.post("/update", async (req) => {
    const { fields, files } = await parseMultipart(req);
    const body = validate(updateSchema, fields);
    return materialService.save(body, files, req.user);
  });
}
