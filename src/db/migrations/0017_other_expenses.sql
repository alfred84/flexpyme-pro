CREATE TABLE IF NOT EXISTS `other_expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`concept` text NOT NULL,
	`expense_type` text DEFAULT 'otros' NOT NULL,
	`employee_id` integer,
	`amount_cup` real DEFAULT 0 NOT NULL,
	`amount_usd` real DEFAULT 0 NOT NULL,
	`payment_method` text DEFAULT 'efectivo' NOT NULL,
	`denomination_breakdown` text,
	`notes` text,
	`cash_transaction_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null
);
