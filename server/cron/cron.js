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
];

// 하루에 한번 재고 통계 적용
cron.schedule("0 * * * *", async () => {
  console.log("===== Daily Stat Start =====");

  StatService.createStockDailyStat();

  console.log("===== Daily Stat End =====");
});

// 매일 00:10 실행
// cron.schedule("10 0 * * *", async () => {
// 한시간 마다 적용
cron.schedule("0 * * * *", async () => {
  console.log("===== Daily Stat Start =====");

  for (const job of jobs) {
    try {
      console.log(`${job.name} Start`);

      await job.fn();

      console.log(`${job.name} Done`);
    } catch (err) {
      console.error(`${job.name} Error`, err);
    }
  }

  console.log("===== Daily Stat End =====");
});
