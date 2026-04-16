import notificationService from "../services/notification.service.js";

/**
 * 알림(Notification) 라우트 (/api/notification/*)
 * 사용자별 알림 조회·읽음·삭제 처리
 */
export default async function notificationRoutes(app) {
  /** 알림 리스트 (로그인 사용자 기준) @route POST /api/notification/list */
  app.post("/list", async (req) => {
    return notificationService.getList(req.body, req.user);
  });

  /** 알림 단건 읽음 처리 @route POST /api/notification/read */
  app.post("/read", async (req) => {
    return notificationService.read(req.body, req.user);
  });

  /** 알림 전체 읽음 처리 @route POST /api/notification/readAll */
  app.post("/readAll", async (req) => {
    return notificationService.readAll(req.body, req.user);
  });

  /** 미읽음 알림 건수 (헤더 배지용) @route POST /api/notification/count */
  app.post("/count", async (req) => {
    return notificationService.count(req.body, req.user);
  });

  /** 알림 유형(NotificationType)별 카운트 @route POST /api/notification/countByType */
  app.post("/countByType", async (req) => {
    return notificationService.countByType(req.body, req.user);
  });

  /** 알림 일괄 삭제 @route POST /api/notification/batchDelete */
  app.post("/batchDelete", async (req) => {
    return notificationService.batchDelete(req.body, req.user);
  });

  /** 알림 일괄 읽음 처리 @route POST /api/notification/batchRead */
  app.post("/batchRead", async (req) => {
    return notificationService.batchRead(req.body, req.user);
  });
}
