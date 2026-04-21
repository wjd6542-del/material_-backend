/*
  Warnings:

  - You are about to drop the column `remark` on the `PurchaseOrderItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Notification` MODIFY `type` ENUM('INBOUND', 'OUTBOUND', 'MATERIAL', 'RETURNORDER', 'STOCK', 'PURCHASEORDER', 'SYSTEM') NOT NULL;

-- AlterTable
ALTER TABLE `PurchaseOrderItem` DROP COLUMN `remark`,
    ADD COLUMN `memo` VARCHAR(191) NULL;
