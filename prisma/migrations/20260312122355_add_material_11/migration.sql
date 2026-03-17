/*
  Warnings:

  - You are about to drop the column `pos_x` on the `Location` table. All the data in the column will be lost.
  - You are about to drop the column `pos_y` on the `Location` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Location` DROP COLUMN `pos_x`,
    DROP COLUMN `pos_y`,
    ADD COLUMN `height` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `width` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `x` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `y` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Warehouse` ADD COLUMN `height` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `width` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `x` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `y` INTEGER NOT NULL DEFAULT 0;
