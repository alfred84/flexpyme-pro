CREATE TABLE IF NOT EXISTS `expense_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `expense_types_name_unique` ON `expense_types` (`name`);
--> statement-breakpoint
INSERT OR IGNORE INTO `expense_types` (`name`, `is_active`, `sort_order`) VALUES
	('Almuerzo', 1, 1),
	('Transporte', 1, 2),
	('Salario', 1, 3),
	('Otros', 1, 99);
--> statement-breakpoint
UPDATE `other_expenses` SET `expense_type` = CASE `expense_type`
	WHEN 'almuerzo' THEN 'Almuerzo'
	WHEN 'transporte' THEN 'Transporte'
	WHEN 'salario' THEN 'Salario'
	WHEN 'otros' THEN 'Otros'
	ELSE `expense_type`
END;
