-- AlterTable
ALTER TABLE `Supplier` ADD COLUMN `fax` VARCHAR(50) NULL,
    ADD COLUMN `mobile` VARCHAR(50) NULL,
    ADD COLUMN `payable` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `receivable` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `registration_no` VARCHAR(20) NULL,
    ADD COLUMN `type` ENUM('INBOUND', 'OUTBOUND') NOT NULL DEFAULT 'INBOUND';

-- CreateTable
CREATE TABLE `SupplierHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `supplier_id` INTEGER NOT NULL,
    `type` ENUM('INBOUND', 'OUTBOUND') NOT NULL,
    `receivable` DECIMAL(18, 2) NOT NULL,
    `payable` DECIMAL(18, 2) NOT NULL,
    `action` VARCHAR(10) NOT NULL,
    `updated_by` INTEGER NULL,
    `reason` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SupplierHistory_supplier_id_created_at_idx`(`supplier_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Supplier_type_idx` ON `Supplier`(`type`);

-- AddForeignKey
ALTER TABLE `SupplierHistory` ADD CONSTRAINT `SupplierHistory_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `Supplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
