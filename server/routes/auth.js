import authService from "../services/auth.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  loginSchema,
  saveSchema,
  changePassword,
  sendCodeSchema,
  codePasswordChangeSchema,
} from "../validators/auth.schema.js";

export default async function authnRoutes(app) {
  // 로그인
  app.post("/login", async (req) => {
    const body = validate(loginSchema, req.body);
    return authService.login(body);
  });

  // 등록
  app.post("/signup", async (req) => {
    console.log("data check ", req.body);
    const body = validate(saveSchema, req.body);
    return authService.signup(body);
  });

  app.post("/changePassword", async (req) => {
    const userId = req.user.id;
    const body = validate(changePassword, req.body);
    return authService.changePassword(userId, body);
  });

  // 비밀번호 찾기
  app.post("/sendCode", async (req) => {
    const body = validate(sendCodeSchema, req.body);
    return authService.sendCode(body);
  });

  // 인증코드 비밀번호 변경처리
  app.post("/codePasswordChange", async (req) => {
    const body = validate(codePasswordChangeSchema, req.body);
    return authService.codePasswordChange(body);
  });
}
