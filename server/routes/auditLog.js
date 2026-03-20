import auditLogService from "../services/auditLog.service.js";
import { permission } from "../middleware/permission.js";

export default async function auditLogRoutes(app) {
  app.post(
    "/list",
    {
      preHandler: permission("dashboard.view"),
    },
    async (req) => {
      return auditLogService.getList(req.body);
    },
  );
}
