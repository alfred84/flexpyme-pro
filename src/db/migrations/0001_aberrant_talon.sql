CREATE TABLE `cash_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`concept` text NOT NULL,
	`reference_type` text,
	`reference_id` integer,
	`amount_cup` real DEFAULT 0 NOT NULL,
	`amount_usd` real DEFAULT 0 NOT NULL,
	`exchange_rate` real DEFAULT 0 NOT NULL,
	`payment_method` text DEFAULT 'efectivo' NOT NULL,
	`denomination_breakdown` text,
	`date` text DEFAULT (datetime('now')) NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cost_list` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_type` text NOT NULL,
	`format_id` integer,
	`unit_cost` real NOT NULL,
	`valid_from` text DEFAULT (date('now')) NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`format_id`) REFERENCES `formats`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`role` text,
	`phone` text,
	`notes` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`unit` text DEFAULT 'unidad' NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`min_stock` real DEFAULT 0 NOT NULL,
	`cost_per_unit` real DEFAULT 0 NOT NULL,
	`supplier` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`type` text NOT NULL,
	`quantity` real NOT NULL,
	`reason` text,
	`reference_id` integer,
	`date` text DEFAULT (datetime('now')) NOT NULL,
	`notes` text,
	FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `formats` ADD `width_inches` real;--> statement-breakpoint
ALTER TABLE `formats` ADD `height_inches` real;--> statement-breakpoint
ALTER TABLE `formats` ADD `is_active` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `payment_method` text;--> statement-breakpoint
ALTER TABLE `product_categories` ADD `label_es` text;--> statement-breakpoint
ALTER TABLE `production_batches` ADD `employee_id` integer REFERENCES employees(id);--> statement-breakpoint
ALTER TABLE `production_batches` ADD `status` text DEFAULT 'pendiente' NOT NULL;