-- AlterTable
ALTER TABLE `User` ADD COLUMN `ip_restrict` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `UserIpWhitelist` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `ip` VARCHAR(191) NOT NULL,
    `memo` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserIpWhitelist_user_id_idx`(`user_id`),
    UNIQUE INDEX `UserIpWhitelist_user_id_ip_key`(`user_id`, `ip`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `return_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `return_no` VARCHAR(191) NOT NULL,
    `outbound_id` INTEGER NULL,
    `status` ENUM('REQUESTED', 'INSPECTING', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'REQUESTED',
    `total_amount` DOUBLE NOT NULL DEFAULT 0,
    `memo` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `return_orders_return_no_key`(`return_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `return_order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `returnOrder_id` INTEGER NOT NULL,
    `material_id` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DOUBLE NOT NULL,
    `reason_type` VARCHAR(191) NOT NULL,
    `stock_status` VARCHAR(191) NOT NULL DEFAULT 'READY',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserIpWhitelist` ADD CONSTRAINT `UserIpWhitelist_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_orders` ADD CONSTRAINT `return_orders_outbound_id_fkey` FOREIGN KEY (`outbound_id`) REFERENCES `Outbound`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_order_items` ADD CONSTRAINT `return_order_items_returnOrder_id_fkey` FOREIGN KEY (`returnOrder_id`) REFERENCES `return_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
