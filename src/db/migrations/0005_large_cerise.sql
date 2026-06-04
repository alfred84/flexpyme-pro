CREATE TABLE `work_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`is_system` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_types_code_unique` ON `work_types` (`code`);--> statement-breakpoint
ALTER TABLE `formats` ADD `is_system` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `formats` ADD `created_at` text;--> statement-breakpoint
UPDATE `formats` SET `created_at` = datetime('now') WHERE `created_at` IS NULL;--> statement-breakpoint
ALTER TABLE `invoice_items` ADD `format_label_snapshot` text;--> statement-breakpoint
ALTER TABLE `production_batches` ADD `work_type_id` integer REFERENCES work_types(id);--> statement-breakpoint
ALTER TABLE `production_batches` ADD `work_type_snapshot` text;--> statement-breakpoint
INSERT INTO `work_types` (`name`, `code`, `description`, `is_system`) VALUES
  ('Laminado', 'laminado', 'Trabajo de laminado', 1),
  ('Enmarcado', 'enmarcado', 'Trabajo de enmarcado', 1),
  ('Solo Respaldo', 'respaldo', 'Solo respaldo', 1),
  ('Impresión', 'impresion', 'Trabajo de impresión', 1);--> statement-breakpoint
UPDATE `production_batches` SET `work_type_id` = (SELECT `id` FROM `work_types` WHERE `code` = `production_batches`.`type`),
  `work_type_snapshot` = (SELECT `name` FROM `work_types` WHERE `code` = `production_batches`.`type`);--> statement-breakpoint
UPDATE `formats` SET `is_system` = 1;--> statement-breakpoint
UPDATE `invoice_items` SET `format_label_snapshot` = (SELECT `label` FROM `formats` WHERE `id` = `invoice_items`.`format_id`) WHERE `format_id` IS NOT NULL;