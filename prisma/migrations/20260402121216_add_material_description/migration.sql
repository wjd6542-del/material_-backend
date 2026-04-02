-- AlterTable
ALTER TABLE `MaterialCategory` ADD COLUMN `depth` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `parent_id` INTEGER NULL,
    ADD COLUMN `path` VARCHAR(191) NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX `MaterialCategory_path_idx` ON `MaterialCategory`(`path`);

-- AddForeignKey
ALTER TABLE `MaterialCategory` ADD CONSTRAINT `MaterialCategory_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `MaterialCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
