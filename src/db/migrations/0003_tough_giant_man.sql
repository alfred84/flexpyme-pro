CREATE TABLE `employee_roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `employees` ADD `role_id` integer REFERENCES employee_roles(id);--> statement-breakpoint
ALTER TABLE `employees` ADD `role_snapshot` text;--> statement-breakpoint
INSERT INTO `employee_roles` (`name`, `description`) VALUES
  ('Laminador', 'Trabajo de laminado de impresiones'),
  ('Enmarcador', 'Trabajo de enmarcado de fotos'),
  ('Impresor', 'Trabajo de impresión'),
  ('Recepcionista', 'Recepción de pedidos y atención al cliente'),
  ('Otro', 'Rol no clasificado');--> statement-breakpoint
UPDATE `employees` SET `role_id` = (SELECT id FROM `employee_roles` WHERE `name` = 'Laminador') WHERE lower(COALESCE(`role`, '')) = 'laminador';--> statement-breakpoint
UPDATE `employees` SET `role_id` = (SELECT id FROM `employee_roles` WHERE `name` = 'Enmarcador') WHERE lower(COALESCE(`role`, '')) = 'enmarcador';--> statement-breakpoint
UPDATE `employees` SET `role_id` = (SELECT id FROM `employee_roles` WHERE `name` = 'Impresor') WHERE lower(COALESCE(`role`, '')) = 'impresor';--> statement-breakpoint
UPDATE `employees` SET `role_id` = (SELECT id FROM `employee_roles` WHERE `name` = 'Recepcionista') WHERE lower(COALESCE(`role`, '')) = 'recepcionista';--> statement-breakpoint
UPDATE `employees` SET `role_id` = (SELECT id FROM `employee_roles` WHERE `name` = 'Otro') WHERE `role_id` IS NULL;--> statement-breakpoint
UPDATE `employees` SET `role_snapshot` = (SELECT `name` FROM `employee_roles` WHERE `id` = `employees`.`role_id`) WHERE `role_snapshot` IS NULL;