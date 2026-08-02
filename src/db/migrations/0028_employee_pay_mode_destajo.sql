-- Modo de pago del empleado: production | fixed | destajo
ALTER TABLE `employees` ADD COLUMN `pay_mode` text NOT NULL DEFAULT 'production';
--> statement-breakpoint
UPDATE `employees`
SET `pay_mode` = 'fixed'
WHERE COALESCE(`has_fixed_daily_salary`, 0) = 1;
--> statement-breakpoint
-- Origen del registro diario (fijo predefinido vs destajo definido ese día).
ALTER TABLE `employee_daily_salaries` ADD COLUMN `kind` text NOT NULL DEFAULT 'fixed';
