import returnorderService from "../services/returnorder.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/returnorder.schema.js";

/**
 * 반품(ReturnOrder) 라우트 (/api/returnorder/*)
 * 반품 전표 CRUD + 상태(REQUESTED/INSPECTING/COMPLETED/REJECTED) 전이 + 재고 반영
 */
export default async function returnorderRoutes(app) {
  /**
   * 반품 전표 전체 리스트
   * @route POST /api/returnorder/allList
   */
  app.post("/allList", async (req) => {
    return returnorderService.getAllList(req.body);
  });

  /**
   * 반품 전표 리스트 (상태/기간 필터)
   * @route POST /api/returnorder/list
   */
  app.post("/list", async (req) => {
    return returnorderService.getList(req.body);
  });

  /**
   * 반품 상세 아이템 리스트
   * @route POST /api/returnorder/detail/list
   */
  app.post("/detail/list", async (req) => {
    return returnorderService.getDetailList(req.body);
  });

  /**
   * 반품 상태별 카운트 (보드 카드용)
   * @route POST /api/returnorder/boardCount
   */
  app.post("/boardCount", async (req) => {
    return returnorderService.boardCount(req.body);
  });

  /**
   * 반품 전표 단건 조회
   * @route POST /api/returnorder/:id
   */
  app.post("/:id", async (req) => {
    const params = validate(idParamSchema, req.params);
    return returnorderService.getById(params.id);
  });

  /**
   * 반품 전표 단건 삭제
   * @route POST /api/returnorder/delete
   */
  app.post("/delete", async (req) => {
    const params = validate(idParamSchema, req.body);
    return returnorderService.deleteById(params.id);
  });

  /**
   * 반품 전표 생성/수정 (COMPLETED 전이 시 재고 증가 + 이력/통계 반영)
   * @route POST /api/returnorder/save
   */
  app.post("/save", async (req) => {
    const user = req.user;
    const body = validate(saveSchema, req.body);
    return returnorderService.save(body, user);
  });

  /**
   * 반품 전표 일괄 삭제
   * @route POST /api/returnorder/batchDelete
   */
  app.post("/batchDelete", async (req) => {
    const body = validate(batchDeleteSchema, req.body);
    return returnorderService.batchDelete(body);
  });
}
