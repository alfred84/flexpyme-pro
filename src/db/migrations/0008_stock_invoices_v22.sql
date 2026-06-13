ALTER TABLE `invoices` ADD `production_completed_at` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `cancelled_at` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `cancelled_reason` text;--> statement-breakpoint
UPDATE `invoices` SET `production_completed_at` = COALESCE(`created_at`, datetime('now'))
  WHERE `production_status` = 'listo' AND `production_completed_at` IS NULL;
