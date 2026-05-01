-- AlterTable
ALTER TABLE `Inbound` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `Outbound` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `PurchaseOrder` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `return_orders` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;
