-- CreateTable
CREATE TABLE `ReturnDailyStat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `material_id` INTEGER NOT NULL,
    `total_qty` INTEGER NOT NULL,
    `total_sales` DECIMAL(18, 2) NOT NULL,
    `total_cost` DECIMAL(18, 2) NOT NULL,
    `total_profit` DECIMAL(18, 2) NOT NULL,

    INDEX `ReturnDailyStat_date_idx`(`date`),
    INDEX `ReturnDailyStat_material_id_idx`(`material_id`),
    UNIQUE INDEX `ReturnDailyStat_date_material_id_key`(`date`, `material_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ReturnDailyStat` ADD CONSTRAINT `ReturnDailyStat_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `Material`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
