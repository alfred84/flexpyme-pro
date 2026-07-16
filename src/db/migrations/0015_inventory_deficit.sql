ALTER TABLE `invoice_items` ADD `resource_missing` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoice_items` ADD `resource_note` text;
--> statement-breakpoint
ALTER TABLE `invoices` ADD `resource_missing` integer DEFAULT 0 NOT NULL;
