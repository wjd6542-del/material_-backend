import inboundService from "../services/inbound.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/inbound.schema.js";
import { permission } from "../middleware/permission.js";

export default async function inboundRoutes(app) {
  app.post(
    "/allList",
    {
      preHandler: permission("inbound.view"),
    },
    async (req) => {
      return inboundService.getAllList(req.body);
    },
  );

  app.post(
    "/list",
    {
      preHandler: permission("inbound.view"),
    },
    async (req) => {
      return inboundService.getList(req.body);
    },
  );

  // 입고 상세
  app.post(
    "/detail/list",
    {
      preHandler: permission("inbound.detail.view"),
    },
    async (req) => {
      return inboundService.detailList(req.body);
    },
  );

  // 정보확인
  app.post(
    "/:id",
    {
      preHandler: permission("inbound.view"),
    },
    async (req) => {
      const params = validate(idParamSchema, req.params);
      return inboundService.getById(params.id);
    },
  );

  // 삭제
  app.post(
    "/delete",
    {
      preHandler: permission("inbound.delete"),
    },
    async (req) => {
      const params = validate(idParamSchema, req.body);
      return inboundService.deleteById(params.id, req.user);
    },
  );

  // 저장, 수정
  app.post(
    "/save",
    {
      //preHandler: permission("inbound.update"),
    },
    async (req) => {
      const user = req.user;
      const body = validate(saveSchema, req.body);
      return inboundService.save(body, user);
    },
  );

  // 일괄
  app.post(
    "/batchSave",
    {
      preHandler: permission("inbound.update"),
    },
    async (req) => {
      const body = validate(batchSaveSchema, req.body);
      return inboundService.batchSave(body, req.user);
    },
  );

  // 일괄 삭제
  app.post(
    "/batchDelete",
    {
      preHandler: permission("inbound.delete"),
    },
    async (req) => {
      const body = validate(batchDeleteSchema, req.body);
      return inboundService.batchDelete(body, req.user);
    },
  );
}
