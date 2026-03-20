/*
  Warnings:

  - You are about to drop the column `unit_price` on the `return_order_items` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `return_orders` table. All the data in the column will be lost.
  - You are about to drop the column `outbound_id` on the `return_orders` table. All the data in the column will be lost.
  - You are about to drop the column `total_amount` on the `return_orders` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `return_orders` table. All the data in the column will be lost.
  - Added the required column `cost_amount` to the `return_order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cost_price` to the `return_order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `location_id` to the `return_order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `profit` to the `return_order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sale_amount` to the `return_order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sale_price` to the `return_order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `warehouse_id` to the `return_order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `return_orders` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `return_orders` DROP FOREIGN KEY `return_orders_outbound_id_fkey`;

-- AlterTable
ALTER TABLE `return_order_items` DROP COLUMN `unit_price`,
    ADD COLUMN `cost_amount` DECIMAL(18, 2) NOT NULL,
    ADD COLUMN `cost_price` DECIMAL(15, 2) NOT NULL,
    ADD COLUMN `location_id` INTEGER NOT NULL,
    ADD COLUMN `profit` DECIMAL(18, 2) NOT NULL,
    ADD COLUMN `sale_amount` DECIMAL(18, 2) NOT NULL,
    ADD COLUMN `sale_price` DECIMAL(15, 2) NOT NULL,
    ADD COLUMN `warehouse_id` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `return_orders` DROP COLUMN `created_at`,
    DROP COLUMN `outbound_id`,
    DROP COLUMN `total_amount`,
    DROP COLUMN `updated_at`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `outboundId` INTEGER NULL,
    ADD COLUMN `totalAmount` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- CreateIndex
CREATE INDEX `return_order_items_material_id_idx` ON `return_order_items`(`material_id`);

-- CreateIndex
CREATE INDEX `return_order_items_warehouse_id_location_id_idx` ON `return_order_items`(`warehouse_id`, `location_id`);

-- CreateIndex
CREATE INDEX `return_order_items_stock_status_idx` ON `return_order_items`(`stock_status`);

-- CreateIndex
CREATE INDEX `return_orders_status_idx` ON `return_orders`(`status`);

-- CreateIndex
CREATE INDEX `return_orders_createdAt_idx` ON `return_orders`(`createdAt`);

-- CreateIndex
CREATE INDEX `return_orders_outboundId_idx` ON `return_orders`(`outboundId`);

-- AddForeignKey
ALTER TABLE `return_orders` ADD CONSTRAINT `return_orders_outboundId_fkey` FOREIGN KEY (`outboundId`) REFERENCES `Outbound`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `return_order_items` RENAME INDEX `return_order_items_returnOrder_id_fkey` TO `return_order_items_returnOrder_id_idx`;
