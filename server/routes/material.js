import materialService from "../services/material.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { parseMultipart } from "../plugins/parseMultipart.plugin.js";

import {
  idParamSchema,
  saveSchema,
  updateSchema,
  batchDeleteSchema,
} from "../validators/material.schema.js";

/**
 * 자재(Material) 라우트 (/api/material/*)
 * 자재 마스터 CRUD + 이미지(다중) 업로드 + 태그 동기화 + QR 코드 발급
 */
export default async function materialRoutes(app) {
  /**
   * 자재 리스트 조회 (태그/카테고리/키워드/기간 필터, 최대 50건, QR 코드 포함)
   * @route POST /api/material/list
   */
  app.post("/list", async (req) => {
    return materialService.getList(req.body, req.user);
  });

  /**
   * 자재 페이지네이션 리스트 (키워드·기간 필터 + skip/take)
   * @route POST /api/material/pageList
   */
  app.post("/pageList", async (req) => {
    return materialService.getPageList(req.body, req.user);
  });

  /**
   * 이번 달 신규 등록 자재 리스트 (대시보드 위젯용)
   * @route POST /api/material/newMonthMaterial
   */
  app.post("/newMonthMaterial", async (req) => {
    return materialService.newMonthMaterial(req.body);
  });

  /**
   * 자재 상세 조회 (이미지·태그·카테고리 포함)
   * @route POST /api/material/:id
   */
  app.post("/:id", async (req) => {
    const params = validate(idParamSchema, req.body);
    return materialService.getById(params.id, req.user);
  });

  /**
   * 자재 단건 삭제 (이미지 파일도 함께 제거)
   * @route POST /api/material/delete
   */
  app.post("/delete", async (req) => {
    const params = validate(idParamSchema, req.body);
    return materialService.deleteById(params.id, req.user);
  });

  /**
   * 자재 일괄 삭제
   * @route POST /api/material/batchDelete
   */
  app.post("/batchDelete", async (req) => {
    const body = validate(batchDeleteSchema, req.body);
    return materialService.batchDelete(body, req.user);
  });

  /**
   * 자재 생성 (multipart/form-data: 이미지 다중 업로드 + 태그 동기화 + 알림 생성)
   * @route POST /api/material/save
   */
  app.post("/save", async (req) => {
    const { fields, files } = await parseMultipart(req);
    const body = validate(saveSchema, fields);
    return await materialService.save(body, files, req.user);
  });

  /**
   * 자재 수정 (이미지 삭제·추가, 태그 재동기화 포함)
   * @route POST /api/material/update
   */
  app.post("/update", async (req) => {
    const { fields, files } = await parseMultipart(req);
    const body = validate(updateSchema, fields);
    return materialService.save(body, files, req.user);
  });
}
