/*
  Warnings:

  - You are about to drop the column `outboundId` on the `return_orders` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `return_orders` DROP FOREIGN KEY `return_orders_outboundId_fkey`;

-- AlterTable
ALTER TABLE `return_orders` DROP COLUMN `outboundId`;
