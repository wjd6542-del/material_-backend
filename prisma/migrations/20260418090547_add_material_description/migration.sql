/*
  Warnings:

  - Made the column `shelf_id` on table `InboundItem` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `supplier_id` to the `OutboundItem` table without a default value. This is not possible if the table is not empty.
  - Made the column `shelf_id` on table `OutboundItem` required. This step will fail if there are existing NULL values in that column.
  - Made the column `shelf_id` on table `return_order_items` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `InboundItem` DROP FOREIGN KEY `InboundItem_shelf_id_fkey`;

-- DropForeignKey
ALTER TABLE `OutboundItem` DROP FOREIGN KEY `OutboundItem_shelf_id_fkey`;

-- DropForeignKey
ALTER TABLE `return_order_items` DROP FOREIGN KEY `return_order_items_shelf_id_fkey`;

-- AlterTable
ALTER TABLE `InboundItem` MODIFY `shelf_id` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `OutboundItem` ADD COLUMN `supplier_id` INTEGER NOT NULL,
    MODIFY `shelf_id` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `return_order_items` MODIFY `shelf_id` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `Business` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `registration_no` VARCHAR(20) NOT NULL,
    `company_name` VARCHAR(200) NOT NULL,
    `ceo_name` VARCHAR(100) NOT NULL,
    `zipcode` VARCHAR(500) NULL,
    `address` VARCHAR(500) NULL,
    `address_detail` VARCHAR(500) NULL,
    `phone` VARCHAR(50) NULL,
    `mobile` VARCHAR(50) NULL,
    `fax` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `Business_registration_no_key`(`registration_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InboundItem` ADD CONSTRAINT `InboundItem_shelf_id_fkey` FOREIGN KEY (`shelf_id`) REFERENCES `Shelf`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OutboundItem` ADD CONSTRAINT `OutboundItem_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OutboundItem` ADD CONSTRAINT `OutboundItem_shelf_id_fkey` FOREIGN KEY (`shelf_id`) REFERENCES `Shelf`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_order_items` ADD CONSTRAINT `return_order_items_shelf_id_fkey` FOREIGN KEY (`shelf_id`) REFERENCES `Shelf`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
