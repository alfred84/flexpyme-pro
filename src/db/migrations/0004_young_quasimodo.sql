ALTER TABLE `invoices` ADD `production_status` text DEFAULT 'en_produccion' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `payment_status` text DEFAULT 'pendiente' NOT NULL;--> statement-breakpoint
UPDATE `invoices` SET `production_status` = 'listo', `payment_status` = 'cobrado' WHERE `status` = 'paid';--> statement-breakpoint
UPDATE `invoices` SET `production_status` = 'en_produccion', `payment_status` = 'pendiente' WHERE `status` IN ('pending', 'partial');