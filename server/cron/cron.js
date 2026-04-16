import cron from "node-cron";
import StatService from "../services/stat.service.js";

/**
 * 일별 통계 배치 작업 스케줄
 * - 실행 시각: 매일 00:10 (Asia/Seoul)
 * - 먼저 재고 일별 스냅샷 생성 후 입고/출고/반품 일별 통계를 순차 처리
 * - 개별 잡 실패해도 다음 잡으로 진행 (에러는 console.error 로 기록)
 * 활성화하려면 server/index.js 의 `import "./cron/cron.js";` 주석을 해제
 */
const jobs = [
  {
    name: "입고 일별 통계",
    fn: () => StatService.createInboundDailyStat(),
  },
  {
    name: "출고 일별 통계",
    fn: () => StatService.createOutboundDailyStat(),
  },
  {
    name: "반품 일별 통계",
    fn: () => StatService.createReturnDailyStat(),
  },
];

// 매일 00:10 실행 (서버 타임존 기준: Asia/Seoul)
cron.schedule(
  "10 0 * * *",
  async () => {
    console.log("===== Daily Stat Start =====");

    try {
      await StatService.createStockDailyStat();

      for (const job of jobs) {
        try {
          console.log(`${job.name} Start`);
          await job.fn();
          console.log(`${job.name} Done`);
        } catch (err) {
          console.error(`${job.name} Error`, err);
        }
      }
    } catch (err) {
      console.error("Stock Daily Stat Error", err);
    }

    console.log("===== Daily Stat End =====");
  },
  {
    timezone: "Asia/Seoul",
  },
);
