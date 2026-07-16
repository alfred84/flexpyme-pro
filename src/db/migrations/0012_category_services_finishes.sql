CREATE TABLE IF NOT EXISTS `category_services` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`service` text NOT NULL,
	`is_default` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `category_finishes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`finish` text NOT NULL,
	`is_default` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `category_services` (`category_id`, `service`, `is_default`, `sort_order`)
SELECT DISTINCT category_id, trim(service), 1, 0
FROM `price_list`
WHERE service IS NOT NULL AND trim(service) <> '';
--> statement-breakpoint
INSERT INTO `category_finishes` (`category_id`, `finish`, `is_default`, `sort_order`)
SELECT DISTINCT category_id, trim(finish), 0, 0
FROM `price_list`
WHERE finish IS NOT NULL AND trim(finish) <> '';
