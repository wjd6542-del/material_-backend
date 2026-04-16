import dashboardService from "../services/dashboard.service.js";
import { permission } from "../middleware/permission.js";

/**
 * 대시보드(Dashboard) 라우트 (/api/dashboard/*)
 * 메인 화면용 종합 지표(재고/입출고/반품 요약) 제공
 */
export default async function dashboardRoutes(app) {
  /**
   * 대시보드 종합 요약 데이터 조회
   * (재고 총량, 안전재고 미만, 당월 입·출고, 반품 추세 등)
   * @route POST /api/dashboard/dashboard
   */
  app.post(
    "/dashboard",
    {
      //preHandler: permission("dashboard.view"),
    },
    async (req) => {
      return dashboardService.getDashboard(req.body);
    },
  );
}
