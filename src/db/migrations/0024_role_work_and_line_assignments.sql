-- Tipos de trabajo que puede realizar un rol de empleado.
CREATE TABLE IF NOT EXISTS `role_work_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role_id` integer NOT NULL REFERENCES `employee_roles`(`id`) ON DELETE CASCADE,
	`work_type_id` integer NOT NULL REFERENCES `work_types`(`id`) ON DELETE CASCADE,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `role_work_types_unique`
	ON `role_work_types` (`role_id`, `work_type_id`);
--> statement-breakpoint
-- Empleados asignados a una línea de pedido (por tipo de trabajo / servicio).
CREATE TABLE IF NOT EXISTS `invoice_item_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_item_id` integer NOT NULL REFERENCES `invoice_items`(`id`) ON DELETE CASCADE,
	`employee_id` integer NOT NULL REFERENCES `employees`(`id`),
	`custom_unit_cost` real,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `invoice_item_assignments_unique`
	ON `invoice_item_assignments` (`invoice_item_id`, `employee_id`);
--> statement-breakpoint
-- Seed opcional: asocia roles por nombre a códigos de tipo de trabajo conocidos.
INSERT OR IGNORE INTO `role_work_types` (`role_id`, `work_type_id`)
SELECT r.id, wt.id
FROM `employee_roles` r
JOIN `work_types` wt ON (
	(lower(r.name) LIKE '%lamin%' AND wt.code = 'laminado')
	OR (lower(r.name) LIKE '%impres%' AND wt.code = 'impresion')
	OR (lower(r.name) LIKE '%enmarc%' AND wt.code = 'enmarcado')
	OR (lower(r.name) LIKE '%respald%' AND wt.code = 'respaldo')
);
