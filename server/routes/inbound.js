import inboundService from "../services/inbound.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/inbound.schema.js";
import { permission } from "../middleware/permission.js";
import { setActiveSchema } from "../validators/setActive.schema.js";

/**
 * 입고(Inbound) 라우트 (/api/inbound/*)
 * 입고 전표 CRUD + 상세 아이템 + 재고/이력 연동
 * 대부분 inbound.* 권한 코드 검사 적용
 */
export default async function inboundRoutes(app) {
  /**
   * 입고 전표 전체 리스트 (권한: inbound.view)
   * @route POST /api/inbound/allList
   */
  app.post(
    "/allList",
    {
      preHandler: permission("inbound.view"),
    },
    async (req) => {
      return inboundService.getAllList(req.body);
    },
  );

  /**
   * 입고 전표 리스트 (필터·기간 적용, 권한: inbound.view)
   * @route POST /api/inbound/list
   */
  app.post(
    "/list",
    {
      preHandler: permission("inbound.view"),
    },
    async (req) => {
      return inboundService.getList(req.body);
    },
  );

  /**
   * 입고 전표 페이지네이션 리스트 (권한: inbound.view)
   * @route POST /api/inbound/pageList
   */
  app.post(
    "/pageList",
    {
      preHandler: permission("inbound.view"),
    },
    async (req) => {
      return inboundService.getPageList(req.body);
    },
  );

  /**
   * 입고 상세(아이템) 리스트 조회 (권한: inbound.detail.view)
   * @route POST /api/inbound/detail/list
   */
  app.post(
    "/detail/list",
    {
      preHandler: permission("inbound.detail.view"),
    },
    async (req) => {
      return inboundService.detailList(req.body);
    },
  );

  /**
   * 입고 상세 아이템 페이지네이션 리스트 (권한: inbound.detail.view)
   * @route POST /api/inbound/detail/pageList
   */
  app.post(
    "/detail/pageList",
    {
      preHandler: permission("inbound.detail.view"),
    },
    async (req) => {
      return inboundService.detailPageList(req.body);
    },
  );

  /**
   * 입고 단건 상세 조회 (권한: inbound.view)
   * @route POST /api/inbound/:id
   */
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

  /**
   * 입고 단건 삭제 (재고 롤백 + 이력 기록, 권한: inbound.delete)
   * @route POST /api/inbound/delete
   */
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

  /**
   * 입고 전표 생성/수정 (아이템별 재고 증감 + StockHistory 기록)
   * @route POST /api/inbound/save
   */
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

  /**
   * 입고 전표 일괄 저장 (권한: inbound.update)
   * @route POST /api/inbound/batchSave
   */
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

  /**
   * 입고 전표 일괄 삭제 (권한: inbound.delete)
   * @route POST /api/inbound/batchDelete
   */
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

  /** inbound 활성/비활성 토글 @route POST /api/inbound/setActive */
  app.post(
    "/setActive",
    { preHandler: permission("inbound.update") },
    async (req) => {
      const body = validate(setActiveSchema, req.body);
      return inboundService.setActive(body, req.user);
    },
  );
}
