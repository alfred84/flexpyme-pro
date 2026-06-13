CREATE TABLE `units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`abbreviation` text NOT NULL,
	`type` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`is_system` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `units_code_unique` ON `units` (`code`);--> statement-breakpoint
INSERT INTO `units` (`code`, `name`, `abbreviation`, `type`, `is_system`) VALUES
  ('un', 'Unidad', 'u', 'cantidad', 1),
  ('rollo', 'Rollo', 'rollo', 'cantidad', 1),
  ('resma', 'Resma', 'resma', 'cantidad', 1),
  ('hoja', 'Hoja', 'hoja', 'cantidad', 1),
  ('litro', 'Litro', 'L', 'volumen', 1),
  ('ml', 'Mililitro', 'mL', 'volumen', 1),
  ('kg', 'Kilogramo', 'kg', 'peso', 1),
  ('g', 'Gramo', 'g', 'peso', 1),
  ('m', 'Metro', 'm', 'longitud', 1),
  ('m2', 'Metro cuadrado', 'm²', 'area', 1);--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `unit_id` integer REFERENCES units(id);--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `unit_snapshot` text;--> statement-breakpoint
UPDATE `inventory_items` SET `unit_id` = (SELECT `id` FROM `units` WHERE `code` = 'un'), `unit_snapshot` = 'Unidad'
  WHERE lower(trim(`unit`)) IN ('unidad', 'un', 'u');--> statement-breakpoint
UPDATE `inventory_items` SET `unit_id` = (SELECT `id` FROM `units` WHERE `code` = 'rollo'), `unit_snapshot` = 'Rollo'
  WHERE lower(trim(`unit`)) IN ('rollo');--> statement-breakpoint
UPDATE `inventory_items` SET `unit_id` = (SELECT `id` FROM `units` WHERE `code` = 'resma'), `unit_snapshot` = 'Resma'
  WHERE lower(trim(`unit`)) IN ('resma');--> statement-breakpoint
UPDATE `inventory_items` SET `unit_id` = (SELECT `id` FROM `units` WHERE `code` = 'hoja'), `unit_snapshot` = 'Hoja'
  WHERE lower(trim(`unit`)) IN ('hoja');--> statement-breakpoint
UPDATE `inventory_items` SET `unit_id` = (SELECT `id` FROM `units` WHERE `code` = 'litro'), `unit_snapshot` = 'Litro'
  WHERE lower(trim(`unit`)) IN ('litro', 'l');--> statement-breakpoint
UPDATE `inventory_items` SET `unit_id` = (SELECT `id` FROM `units` WHERE `code` = 'kg'), `unit_snapshot` = 'Kilogramo'
  WHERE lower(trim(`unit`)) IN ('kg', 'kilogramo');--> statement-breakpoint
UPDATE `inventory_items` SET `unit_id` = (SELECT `id` FROM `units` WHERE `code` = 'un'), `unit_snapshot` = 'Unidad'
  WHERE `unit_id` IS NULL;--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD `unit_snapshot` text;--> statement-breakpoint
UPDATE `inventory_movements` SET `unit_snapshot` = (
  SELECT COALESCE(`unit_snapshot`, `unit`) FROM `inventory_items` WHERE `id` = `inventory_movements`.`item_id`
);
