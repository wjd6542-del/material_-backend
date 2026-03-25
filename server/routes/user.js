import userService from "../services/user.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  idPermissionSchema,
} from "../validators/user.schema.js";

export default async function userRoutes(app) {
  // 계정 정보 조회 리스트
  app.post("/list", async (req) => {
    return userService.getList(req.body);
  });

  // 계정 정보 조회
  app.post("/:id", async (req) => {
    const params = validate(idParamSchema, req.params);
    return userService.getById(params.id);
  });

  // 계정 권한 설정
  app.post("/setPermission", async (req) => {
    const body = validate(idPermissionSchema, req.body);
    return userService.setPermission(body);
  });

  // 계정 아이피 리스트
  app.post("/ip/list", async (req) => {
    return userService.getUserIpList(req.body);
  });

  // 계정 아이피 저장 처리
  app.post("/ip/batchSave", async (req) => {
    return userService.batchIpSave(req.body);
  });

  // 아이피 일괄 삭제
  app.post("/ip/batchDelete", async (req) => {
    return userService.batchIpDelete(req.body);
  });

  // 계정 아이피 적용활성화 수정여부
  app.post("/ip/toggle", async (req) => {
    return userService.ipToggle(req.body);
  });
}
