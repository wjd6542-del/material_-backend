-- CreateTable
CREATE TABLE `MaterialRate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `outbound_rate1` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    `outbound_rate2` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    `wholesale_rate1` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    `wholesale_rate2` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    `online_rate` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    `updated_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaterialRateHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rate_id` INTEGER NOT NULL,
    `outbound_rate1` DECIMAL(7, 4) NOT NULL,
    `outbound_rate2` DECIMAL(7, 4) NOT NULL,
    `wholesale_rate1` DECIMAL(7, 4) NOT NULL,
    `wholesale_rate2` DECIMAL(7, 4) NOT NULL,
    `online_rate` DECIMAL(7, 4) NOT NULL,
    `updated_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MaterialRateHistory_rate_id_created_at_idx`(`rate_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MaterialRateHistory` ADD CONSTRAINT `MaterialRateHistory_rate_id_fkey` FOREIGN KEY (`rate_id`) REFERENCES `MaterialRate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
