import dashboardService from "../services/dashboard.service.js";

export default async function dashboardRoutes(app) {
  app.post("/dashboard", async (req) => {
    return dashboardService.getDashboard(req.body);
  });
}
