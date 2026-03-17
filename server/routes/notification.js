import notificationService from "../services/notification.service.js";

export default async function notificationRoutes(app) {
  // 리스트
  app.post("/list", async (req) => {
    return notificationService.getList(req.body, req.user);
  });

  // 읽기 처리
  app.post("/read", async (req) => {
    return notificationService.read(req.body, req.user);
  });

  // 전체 읽기 처리
  app.post("/readAll", async (req) => {
    return notificationService.readAll(req.body, req.user);
  });

  // 전체 갯수
  app.post("/count", async (req) => {
    return notificationService.count(req.body, req.user);
  });

  // 해더 알림 그룹
  app.post("/countByType", async (req) => {
    return notificationService.countByType(req.body, req.user);
  });

  // 일괄 삭제 처리
  app.post("/batchDelete", async (req) => {
    return notificationService.batchDelete(req.body, req.user);
  });
}
