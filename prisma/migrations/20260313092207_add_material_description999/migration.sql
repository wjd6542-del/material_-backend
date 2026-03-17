-- AddForeignKey
ALTER TABLE `StockHistory` ADD CONSTRAINT `StockHistory_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
