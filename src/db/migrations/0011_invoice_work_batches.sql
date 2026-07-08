ALTER TABLE `production_batch_items` ADD `invoice_id` integer REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action;
