-- Salario fijo mensual: un cobro por mes calendario, pagable cualquier día del mes.
ALTER TABLE `employees` ADD COLUMN `fixed_monthly_salary_cup` real NOT NULL DEFAULT 0;
