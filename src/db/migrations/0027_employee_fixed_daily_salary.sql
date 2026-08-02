-- Salario fijo diario opcional por empleado (alternativa a tarifas por producción).
ALTER TABLE `employees` ADD COLUMN `has_fixed_daily_salary` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `employees` ADD COLUMN `fixed_daily_salary_cup` real NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE `employee_daily_salaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`date` text NOT NULL,
	`amount_cup` real NOT NULL,
	`paid` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pendiente' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employee_daily_salaries_emp_date_uidx`
	ON `employee_daily_salaries` (`employee_id`, `date`);
