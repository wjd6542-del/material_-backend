import dashboardService from "../services/dashboard.service.js";
import { permission } from "../middleware/permission.js";

export default async function dashboardRoutes(app) {
  app.post(
    "/dashboard",
    {
      preHandler: permission("dashboard.view"),
    },
    async (req) => {
      return dashboardService.getDashboard(req.body);
    },
  );
}
