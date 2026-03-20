/*
  Warnings:

  - Added the required column `user_id` to the `return_orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `return_orders` ADD COLUMN `user_id` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `return_orders` ADD CONSTRAINT `return_orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
