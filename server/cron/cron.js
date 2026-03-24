import cron from "node-cron";
import StatService from "../services/stat.service.js";

// 실행할 통계 목록
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
