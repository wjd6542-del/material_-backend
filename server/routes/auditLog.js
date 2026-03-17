import auditLogService from "../services/auditLog.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { searchSchema } from "../validators/auditLog.schema.js";

export default async function auditLogRoutes(app) {
  app.post("/list", async (req) => {
    return auditLogService.getList(req.body);
  });
}
