-- AlterTable
ALTER TABLE `InboundDailyStat` MODIFY `date` DATE NOT NULL;

-- AlterTable
ALTER TABLE `OutboundDailyStat` MODIFY `date` DATE NOT NULL;

-- AlterTable
ALTER TABLE `StockDailySnapshot` MODIFY `date` DATE NOT NULL;
