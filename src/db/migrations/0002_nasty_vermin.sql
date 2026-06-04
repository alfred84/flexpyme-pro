ALTER TABLE `invoices` ADD `payment_currency` text DEFAULT 'CUP';--> statement-breakpoint
ALTER TABLE `invoices` ADD `exchange_rate_snapshot` real;--> statement-breakpoint
ALTER TABLE `invoices` ADD `amount_usd` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `amount_cup` real DEFAULT 0 NOT NULL;