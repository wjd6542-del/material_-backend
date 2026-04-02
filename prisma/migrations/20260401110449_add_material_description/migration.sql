/*
  Warnings:

  - You are about to drop the column `height` on the `Location` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `Location` table. All the data in the column will be lost.
  - You are about to drop the column `x` on the `Location` table. All the data in the column will be lost.
  - You are about to drop the column `y` on the `Location` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[material_id,warehouse_id,location_id,shelf_id]` on the table `Stock` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey (must drop before dropping the index they rely on)
ALTER TABLE `Stock` DROP FOREIGN KEY `Stock_material_id_fkey`;
ALTER TABLE `Stock` DROP FOREIGN KEY `Stock_warehouse_id_fkey`;
ALTER TABLE `Stock` DROP FOREIGN KEY `Stock_location_id_fkey`;

-- DropIndex
DROP INDEX `Stock_material_id_warehouse_id_location_id_key` ON `Stock`;

-- AlterTable
ALTER TABLE `InboundItem` ADD COLUMN `shelf_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `Location` DROP COLUMN `height`,
    DROP COLUMN `width`,
    DROP COLUMN `x`,
    DROP COLUMN `y`,
    ADD COLUMN `color` VARCHAR(191) NULL,
    ADD COLUMN `points` JSON NULL,
    ADD COLUMN `rotation` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `OutboundItem` ADD COLUMN `shelf_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `Stock` ADD COLUMN `shelf_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `StockHistory` ADD COLUMN `shelf_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `return_order_items` ADD COLUMN `shelf_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `Shelf` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `location_id` INTEGER NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(191) NULL,
    `x` INTEGER NOT NULL DEFAULT 0,
    `y` INTEGER NOT NULL DEFAULT 0,
    `width` INTEGER NOT NULL DEFAULT 0,
    `height` INTEGER NOT NULL DEFAULT 0,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Shelf_location_id_code_key`(`location_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Stock_material_id_warehouse_id_location_id_shelf_id_key` ON `Stock`(`material_id`, `warehouse_id`, `location_id`, `shelf_id`);

-- Re-AddForeignKey (dropped earlier to allow index replacement)
ALTER TABLE `Stock` ADD CONSTRAINT `Stock_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `Material`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Stock` ADD CONSTRAINT `Stock_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Stock` ADD CONSTRAINT `Stock_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Shelf` ADD CONSTRAINT `Shelf_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Stock` ADD CONSTRAINT `Stock_shelf_id_fkey` FOREIGN KEY (`shelf_id`) REFERENCES `Shelf`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockHistory` ADD CONSTRAINT `StockHistory_shelf_id_fkey` FOREIGN KEY (`shelf_id`) REFERENCES `Shelf`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InboundItem` ADD CONSTRAINT `InboundItem_shelf_id_fkey` FOREIGN KEY (`shelf_id`) REFERENCES `Shelf`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OutboundItem` ADD CONSTRAINT `OutboundItem_shelf_id_fkey` FOREIGN KEY (`shelf_id`) REFERENCES `Shelf`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_order_items` ADD CONSTRAINT `return_order_items_shelf_id_fkey` FOREIGN KEY (`shelf_id`) REFERENCES `Shelf`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
