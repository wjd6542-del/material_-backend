import materialRateService from "../services/materialRate.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  saveSchema,
  historyListSchema,
} from "../validators/materialRate.schema.js";

/**
 * 자재 요율 공통 설정(MaterialRate) 라우트 (/api/materialRate/*)
 * 싱글톤 관리 + 변경 스냅샷 이력 조회
 */
export default async function materialRateRoutes(app) {
  /** 현재 요율 조회 @route POST /api/materialRate/info */
  app.post("/info", async () => {
    return materialRateService.getInfo();
  });

  /** 요율 저장/수정 (변경 시 스냅샷 이력 기록) @route POST /api/materialRate/save */
  app.post("/save", async (req) => {
    const body = validate(saveSchema, req.body);
    return materialRateService.save(body, req.user);
  });

  /** 요율 변경 이력 리스트 @route POST /api/materialRate/history */
  app.post("/history", async (req) => {
    console.log("check > ", req.body);

    const body = validate(historyListSchema, req.body);
    return materialRateService.getHistory(body);
  });
}
