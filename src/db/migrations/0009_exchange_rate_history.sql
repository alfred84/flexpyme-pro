CREATE TABLE IF NOT EXISTS `exchange_rate_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rate` real NOT NULL,
	`effective_at` text DEFAULT (datetime('now')) NOT NULL,
	`source` text DEFAULT 'config' NOT NULL,
	`previous_rate` real
);
