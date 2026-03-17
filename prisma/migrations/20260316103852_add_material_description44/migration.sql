-- AlterTable
ALTER TABLE `AuditLog` MODIFY `action` ENUM('CREATE', 'UPDATE', 'DELETE', 'UPSERT', 'CREATEMANY', 'UPSERTMANY', 'DELETEMANY', 'VIEW', 'LOGIN', 'LOGOUT') NOT NULL;

-- CreateIndex
CREATE INDEX `OutboundDailyStat_date_idx` ON `OutboundDailyStat`(`date`);

-- RenameIndex
ALTER TABLE `OutboundDailyStat` RENAME INDEX `OutboundDailyStat_material_id_fkey` TO `OutboundDailyStat_material_id_idx`;
