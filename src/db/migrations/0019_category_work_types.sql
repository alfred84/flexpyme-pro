CREATE TABLE IF NOT EXISTS `category_work_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`work_type_id` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_type_id`) REFERENCES `work_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `category_work_types_unique`
ON `category_work_types` (`category_id`, `work_type_id`);
