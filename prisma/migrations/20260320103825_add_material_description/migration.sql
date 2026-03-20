/*
  Warnings:

  - You are about to drop the column `createdAt` on the `return_orders` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `return_orders` table. All the data in the column will be lost.
  - Added the required column `updated_at` to the `return_orders` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `return_orders_createdAt_idx` ON `return_orders`;

-- AlterTable
ALTER TABLE `return_orders` DROP COLUMN `createdAt`,
    DROP COLUMN `updatedAt`,
    ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL;

-- CreateIndex
CREATE INDEX `return_orders_created_at_idx` ON `return_orders`(`created_at`);
