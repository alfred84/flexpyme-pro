ALTER TABLE `invoice_items` ADD `completed_quantity` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `invoice_items` ADD `completed_at` text;
