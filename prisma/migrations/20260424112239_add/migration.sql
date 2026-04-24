/*
  Warnings:

  - You are about to drop the column `amount` on the `InboundItem` table. All the data in the column will be lost.
  - You are about to drop the column `unit_price` on the `InboundItem` table. All the data in the column will be lost.
  - Added the required column `price` to the `InboundItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supply_amount` to the `InboundItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Inbound` ADD COLUMN `purchase_date` DATETIME(3) NULL,
    ADD COLUMN `supplier_id` INTEGER NULL,
    ADD COLUMN `vat_applied` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `InboundItem` DROP COLUMN `amount`,
    DROP COLUMN `unit_price`,
    ADD COLUMN `price` DECIMAL(15, 2) NOT NULL,
    ADD COLUMN `supply_amount` DECIMAL(18, 2) NOT NULL,
    ADD COLUMN `vat` DECIMAL(18, 2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `Inbound_supplier_id_idx` ON `Inbound`(`supplier_id`);

-- AddForeignKey
ALTER TABLE `Inbound` ADD CONSTRAINT `Inbound_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
