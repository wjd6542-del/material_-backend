import outboundService from "../services/outbound.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/outbound.schema.js";
import { permission } from "../middleware/permission.js";

/**
 * 출고(Outbound) 라우트 (/api/outbound/*)
 * 출고 전표 CRUD + 원가/판매/이익 계산 + 반품 대상 목록 조회
 */
export default async function outboundRoutes(app) {
  /** 출고 전표 전체 리스트 @route POST /api/outbound/allList */
  app.post(
    "/allList",
    { preHandler: permission("outbound.view") },
    async (req) => {
      return outboundService.getAllList(req.body);
    },
  );

  /** 출고 전표 리스트 @route POST /api/outbound/list */
  app.post(
    "/list",
    { preHandler: permission("outbound.view") },
    async (req) => {
      return outboundService.getList(req.body);
    },
  );

  /** 출고 현황 집계 @route POST /api/outbound/boardCount */
  app.post(
    "/boardCount",
    { preHandler: permission("outbound.view") },
    async (req) => {
      return outboundService.boardCount(req.body);
    },
  );

  /** 출고 상세 아이템 리스트 @route POST /api/outbound/detail/list */
  app.post(
    "/detail/list",
    { preHandler: permission("outbound.detail.view") },
    async (req) => {
      return outboundService.detailList(req.body);
    },
  );

  /** 반품 가능 출고 아이템 목록 @route POST /api/outbound/returnList */
  app.post(
    "/returnList",
    { preHandler: permission("returnorder.view") },
    async (req) => {
      return outboundService.returnList(req.body);
    },
  );

  /** 출고 단건 상세 @route POST /api/outbound/:id */
  app.post(
    "/:id",
    { preHandler: permission("outbound.view") },
    async (req) => {
      const params = validate(idParamSchema, req.params);
      return outboundService.getById(params.id);
    },
  );

  /** 출고 단건 삭제 @route POST /api/outbound/delete */
  app.post(
    "/delete",
    { preHandler: permission("outbound.delete") },
    async (req) => {
      const params = validate(idParamSchema, req.body);
      return outboundService.deleteById(params.id);
    },
  );

  /** 출고 전표 생성/수정 @route POST /api/outbound/save */
  app.post(
    "/save",
    { preHandler: permission("outbound.update") },
    async (req) => {
      const user = req.user;
      const body = validate(saveSchema, req.body);
      return outboundService.save(body, user);
    },
  );

  /** 출고 전표 일괄 저장 @route POST /api/outbound/batchSave */
  app.post(
    "/batchSave",
    { preHandler: permission("outbound.update") },
    async (req) => {
      const body = validate(batchSaveSchema, req.body);
      return outboundService.batchSave(body);
    },
  );

  /** 출고 전표 일괄 삭제 @route POST /api/outbound/batchDelete */
  app.post(
    "/batchDelete",
    { preHandler: permission("outbound.delete") },
    async (req) => {
      const body = validate(batchDeleteSchema, req.body);
      return outboundService.batchDelete(body);
    },
  );
}
