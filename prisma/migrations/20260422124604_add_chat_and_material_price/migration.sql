-- AlterTable
ALTER TABLE `Material` ADD COLUMN `online_rate` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `outbound_rate1` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `outbound_rate2` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `wholesale_rate1` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `wholesale_rate2` DECIMAL(7, 4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `MaterialPriceHistory` ADD COLUMN `online_rate` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `outbound_rate1` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `outbound_rate2` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `wholesale_rate1` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `wholesale_rate2` DECIMAL(7, 4) NOT NULL DEFAULT 0;
