/*
  Warnings:

  - Added the required column `location_id` to the `StockHistory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `StockHistory` ADD COLUMN `location_id` INTEGER NOT NULL;
