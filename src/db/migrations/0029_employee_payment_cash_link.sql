-- Vínculo del pago de salario/lote con el egreso de caja (para reverso mismo día).
ALTER TABLE `production_batches` ADD COLUMN `cash_transaction_id` integer;
--> statement-breakpoint
ALTER TABLE `employee_daily_salaries` ADD COLUMN `cash_transaction_id` integer;
