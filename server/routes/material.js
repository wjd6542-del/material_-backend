import materialService from "../services/material.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { parseMultipart } from "../plugins/parseMultipart.plugin.js";
import { permission } from "../middleware/permission.js";

import {
  idParamSchema,
  saveSchema,
  updateSchema,
  batchDeleteSchema,
  priceHistoryListSchema,
} from "../validators/material.schema.js";

/**
 * 자재(Material) 라우트 (/api/material/*)
 * 자재 마스터 CRUD + 이미지(다중) 업로드 + 태그 동기화 + QR 코드 발급
 */
export default async function materialRoutes(app) {
  /** 자재 리스트 @route POST /api/material/list */
  app.post(
    "/list",
    { preHandler: permission("material.view") },
    async (req) => {
      return materialService.getList(req.body, req.user);
    },
  );

  /** 자재 페이지네이션 리스트 @route POST /api/material/pageList */
  app.post(
    "/pageList",
    { preHandler: permission("material.view") },
    async (req) => {
      return materialService.getPageList(req.body, req.user);
    },
  );

  /** 이번 달 신규 자재 (대시보드 위젯) @route POST /api/material/newMonthMaterial */
  app.post(
    "/newMonthMaterial",
    { preHandler: permission("dashboard.view") },
    async (req) => {
      return materialService.newMonthMaterial(req.body);
    },
  );

  /** 자재 가격 이력 @route POST /api/material/priceHistory */
  app.post(
    "/priceHistory",
    { preHandler: permission("material.view") },
    async (req) => {
      const body = validate(priceHistoryListSchema, req.body);
      return materialService.getPriceHistory(body);
    },
  );

  /** 자재 상세 @route POST /api/material/:id */
  app.post(
    "/:id",
    { preHandler: permission("material.view") },
    async (req) => {
      const params = validate(idParamSchema, req.body);
      return materialService.getById(params.id, req.user);
    },
  );

  /** 자재 단건 삭제 @route POST /api/material/delete */
  app.post(
    "/delete",
    { preHandler: permission("material.delete") },
    async (req) => {
      const params = validate(idParamSchema, req.body);
      return materialService.deleteById(params.id, req.user);
    },
  );

  /** 자재 일괄 삭제 @route POST /api/material/batchDelete */
  app.post(
    "/batchDelete",
    { preHandler: permission("material.delete") },
    async (req) => {
      const body = validate(batchDeleteSchema, req.body);
      return materialService.batchDelete(body, req.user);
    },
  );

  /** 자재 생성 @route POST /api/material/save */
  app.post(
    "/save",
    { preHandler: permission("material.create") },
    async (req) => {
      const { fields, files } = await parseMultipart(req);
      const body = validate(saveSchema, fields);
      return await materialService.save(body, files, req.user);
    },
  );

  /** 자재 수정 @route POST /api/material/update */
  app.post(
    "/update",
    { preHandler: permission("material.update") },
    async (req) => {
      const { fields, files } = await parseMultipart(req);
      const body = validate(updateSchema, fields);
      return materialService.save(body, files, req.user);
    },
  );
}
