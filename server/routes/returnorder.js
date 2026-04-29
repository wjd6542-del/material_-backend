import returnorderService from "../services/returnorder.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/returnorder.schema.js";
import { permission } from "../middleware/permission.js";

/**
 * 반품(ReturnOrder) 라우트 (/api/returnorder/*)
 * 반품 전표 CRUD + 상태(REQUESTED/INSPECTING/COMPLETED/REJECTED) 전이 + 재고 반영
 */
export default async function returnorderRoutes(app) {
  /** 반품 전표 전체 리스트 @route POST /api/returnorder/allList */
  app.post(
    "/allList",
    { preHandler: permission("returnorder.view") },
    async (req) => {
      return returnorderService.getAllList(req.body);
    },
  );

  /** 반품 전표 리스트 @route POST /api/returnorder/list */
  app.post(
    "/list",
    { preHandler: permission("returnorder.view") },
    async (req) => {
      return returnorderService.getList(req.body);
    },
  );

  /** 반품 전표 페이지네이션 리스트 @route POST /api/returnorder/pageList */
  app.post(
    "/pageList",
    { preHandler: permission("returnorder.view") },
    async (req) => {
      return returnorderService.getPageList(req.body);
    },
  );

  /** 반품 상세 아이템 리스트 @route POST /api/returnorder/detail/list */
  app.post(
    "/detail/list",
    { preHandler: permission("returnorder.detail.view") },
    async (req) => {
      return returnorderService.getDetailList(req.body);
    },
  );

  /** 반품 상세 아이템 페이지네이션 리스트 @route POST /api/returnorder/detail/pageList */
  app.post(
    "/detail/pageList",
    { preHandler: permission("returnorder.detail.view") },
    async (req) => {
      return returnorderService.getDetailPageList(req.body);
    },
  );

  /** 반품 상태별 카운트 @route POST /api/returnorder/boardCount */
  app.post(
    "/boardCount",
    { preHandler: permission("returnorder.view") },
    async (req) => {
      return returnorderService.boardCount(req.body);
    },
  );

  /** 반품 전표 단건 조회 @route POST /api/returnorder/:id */
  app.post(
    "/:id",
    { preHandler: permission("returnorder.view") },
    async (req) => {
      const params = validate(idParamSchema, req.params);
      return returnorderService.getById(params.id);
    },
  );

  /** 반품 전표 단건 삭제 @route POST /api/returnorder/delete */
  app.post(
    "/delete",
    { preHandler: permission("returnorder.delete") },
    async (req) => {
      const params = validate(idParamSchema, req.body);
      return returnorderService.deleteById(params.id, req.user);
    },
  );

  /** 반품 전표 생성/수정 @route POST /api/returnorder/save */
  app.post(
    "/save",
    { preHandler: permission("returnorder.update") },
    async (req) => {
      const user = req.user;
      const body = validate(saveSchema, req.body);
      return returnorderService.save(body, user);
    },
  );

  /** 반품 전표 일괄 삭제 @route POST /api/returnorder/batchDelete */
  app.post(
    "/batchDelete",
    { preHandler: permission("returnorder.delete") },
    async (req) => {
      const body = validate(batchDeleteSchema, req.body);
      return returnorderService.batchDelete(body, req.user);
    },
  );
}
