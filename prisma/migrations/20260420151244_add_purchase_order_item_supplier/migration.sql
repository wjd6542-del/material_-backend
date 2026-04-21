/*
  Warnings:

  - Added the required column `supplier_id` to the `PurchaseOrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `PurchaseOrderItem` ADD COLUMN `supplier_id` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `PurchaseOrderItem_supplier_id_idx` ON `PurchaseOrderItem`(`supplier_id`);

-- AddForeignKey
ALTER TABLE `PurchaseOrderItem` ADD CONSTRAINT `PurchaseOrderItem_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
