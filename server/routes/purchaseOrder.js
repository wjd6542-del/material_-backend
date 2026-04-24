import purchaseOrderService from "../services/purchaseOrder.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchDeleteSchema,
} from "../validators/purchaseOrder.schema.js";
import { permission } from "../middleware/permission.js";

/**
 * 발주(PurchaseOrder) 라우트 (/api/purchaseOrder/*)
 * 발주 전표 CRUD + 품목 저장
 */
export default async function purchaseOrderRoutes(app) {
  /**
   * 발주 전표 리스트
   * @route POST /api/purchaseOrder/list
   */
  app.post(
    "/list",
    {
      preHandler: permission("purchaseorder.view"),
    },
    async (req) => {
      return purchaseOrderService.getList(req.body);
    },
  );

  /**
   * 발주 품목(상세) 리스트 조회 (자재/거래처/상태/기간 필터)
   * @route POST /api/purchaseOrder/detail/list
   */
  app.post(
    "/detail/list",
    {
      preHandler: permission("purchaseorder.detail.view"),
    },
    async (req) => {
      return purchaseOrderService.detailList(req.body);
    },
  );

  /**
   * 발주 전표 단건 상세 조회 (items/material/supplier 포함)
   * @route POST /api/purchaseOrder/info
   */
  app.post(
    "/info",
    {
      preHandler: permission("purchaseorder.view"),
    },
    async (req) => {
      const params = validate(idParamSchema, req.body);
      return purchaseOrderService.getById(params.id);
    },
  );

  /**
   * 발주 전표 단건 상세 조회 (URL 파라미터 방식)
   * @route POST /api/purchaseOrder/:id
   */
  app.post(
    "/:id",
    {
      preHandler: permission("purchaseorder.view"),
    },
    async (req) => {
      const params = validate(idParamSchema, req.params);
      return purchaseOrderService.getById(params.id);
    },
  );

  /**
   * 발주 전표 단건 삭제
   * @route POST /api/purchaseOrder/delete
   */
  app.post(
    "/delete",
    {
      preHandler: permission("purchaseorder.delete"),
    },
    async (req) => {
      const params = validate(idParamSchema, req.body);
      return purchaseOrderService.deleteById(params.id);
    },
  );

  /**
   * 발주 전표 생성/수정
   * @route POST /api/purchaseOrder/save
   */
  app.post(
    "/save",
    {
      preHandler: permission("purchaseorder.update"),
    },
    async (req) => {
      const user = req.user;
      const body = validate(saveSchema, req.body);
      return purchaseOrderService.save(body, user);
    },
  );

  /**
   * 발주 전표 일괄 삭제
   * @route POST /api/purchaseOrder/batchDelete
   */
  app.post(
    "/batchDelete",
    {
      preHandler: permission("purchaseorder.delete"),
    },
    async (req) => {
      const body = validate(batchDeleteSchema, req.body);
      return purchaseOrderService.batchDelete(body);
    },
  );
}
