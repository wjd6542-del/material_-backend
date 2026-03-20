-- AddForeignKey
ALTER TABLE `return_order_items` ADD CONSTRAINT `return_order_items_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `Material`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_order_items` ADD CONSTRAINT `return_order_items_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_order_items` ADD CONSTRAINT `return_order_items_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
