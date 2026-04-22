-- AlterTable
ALTER TABLE `ChatMessage` ADD COLUMN `deleted_at` DATETIME(3) NULL,
    ADD COLUMN `deleted_by` INTEGER NULL,
    ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Material` ADD COLUMN `inbound_price` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `online_price` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `outbound_price1` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `outbound_price2` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `wholesale_price1` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `wholesale_price2` DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `MaterialPriceHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `material_id` INTEGER NOT NULL,
    `inbound_price` DECIMAL(15, 2) NOT NULL,
    `outbound_price1` DECIMAL(15, 2) NOT NULL,
    `outbound_price2` DECIMAL(15, 2) NOT NULL,
    `wholesale_price1` DECIMAL(15, 2) NOT NULL,
    `wholesale_price2` DECIMAL(15, 2) NOT NULL,
    `online_price` DECIMAL(15, 2) NOT NULL,
    `action` VARCHAR(10) NOT NULL,
    `changed_by` INTEGER NULL,
    `reason` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MaterialPriceHistory_material_id_created_at_idx`(`material_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MaterialPriceHistory` ADD CONSTRAINT `MaterialPriceHistory_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `Material`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
