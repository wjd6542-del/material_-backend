/*
  Warnings:

  - You are about to drop the column `height` on the `Warehouse` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `Warehouse` table. All the data in the column will be lost.
  - You are about to drop the column `x` on the `Warehouse` table. All the data in the column will be lost.
  - You are about to drop the column `y` on the `Warehouse` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Warehouse` DROP COLUMN `height`,
    DROP COLUMN `width`,
    DROP COLUMN `x`,
    DROP COLUMN `y`,
    ADD COLUMN `color` VARCHAR(191) NULL,
    ADD COLUMN `points` JSON NULL,
    ADD COLUMN `rotation` DOUBLE NOT NULL DEFAULT 0;
