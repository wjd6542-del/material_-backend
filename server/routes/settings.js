import settingsService from "../services/settings.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/settings.schema.js";

export default async function settingsRoutes(app) {
  app.post("/allList", async (req) => {
    return settingsService.getAllList(req.body);
  });

  app.post("/list", async (req) => {
    return settingsService.getList(req.body);
  });

  app.post("/keyGroup", async (req) => {
    return settingsService.getKeyGroup(req.body);
  });

  // 결과 조회
  app.post("/getGradeList", async (req) => {
    const keys = ["climb_type", "environment_type", "rock_type"];

    const results = await Promise.all(
      keys.map((key) =>
        settingsService.getViewList({ key }).then((data) => [key, data]),
      ),
    );

    return Object.fromEntries(results);
  });

  app.get("/:id", async (req) => {
    const params = validate(idParamSchema, req.params);
    return settingsService.getById(params.id);
  });

  app.post("/delete", async (req) => {
    const params = validate(idParamSchema, req.body);
    return settingsService.deleteById(params.id);
  });

  app.post("/save", async (req) => {
    const body = validate(saveSchema, req.body);
    return settingsService.save(body);
  });

  // 일괄 저장
  app.post("/batchSave", async (req) => {
    const body = validate(batchSaveSchema, req.body);
    return settingsService.batchSave(body);
  });

  // 일괄 삭제
  app.post("/batchDelete", async (req) => {
    const body = validate(batchDeleteSchema, req.body);
    return settingsService.batchDelete(body);
  });
}
