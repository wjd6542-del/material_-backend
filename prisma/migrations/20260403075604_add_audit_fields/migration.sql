/*
  Warnings:

  - Added the required column `updated_at` to the `Inbound` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Outbound` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Inbound` ADD COLUMN `created_by` INTEGER NULL,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL,
    ADD COLUMN `updated_by` INTEGER NULL;

-- AlterTable
ALTER TABLE `Outbound` ADD COLUMN `created_by` INTEGER NULL,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL,
    ADD COLUMN `updated_by` INTEGER NULL;

-- AlterTable
ALTER TABLE `Stock` ADD COLUMN `updated_by` INTEGER NULL;

-- AlterTable
ALTER TABLE `StockHistory` ADD COLUMN `created_by` INTEGER NULL;

-- AlterTable
ALTER TABLE `return_orders` ADD COLUMN `created_by` INTEGER NULL,
    ADD COLUMN `updated_by` INTEGER NULL;
