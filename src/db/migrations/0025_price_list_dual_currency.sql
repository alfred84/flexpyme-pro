-- Precios de venta duales CUP / USD con activación independiente.
ALTER TABLE `price_list` ADD COLUMN `price_cup` real;
--> statement-breakpoint
ALTER TABLE `price_list` ADD COLUMN `price_usd` real;
--> statement-breakpoint
ALTER TABLE `price_list` ADD COLUMN `is_cup_active` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `price_list` ADD COLUMN `is_usd_active` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
-- Backfill: el precio histórico pasa a CUP activo.
UPDATE `price_list`
SET `price_cup` = `price`
WHERE `price_cup` IS NULL;
