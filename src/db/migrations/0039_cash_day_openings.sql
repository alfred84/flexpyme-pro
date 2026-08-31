-- Conteo de efectivo (denominaciones) al inicio de un día calendario.
CREATE TABLE IF NOT EXISTS `cash_day_openings` (
	`day` text PRIMARY KEY NOT NULL,
	`counts_cup` text,
	`counts_usd` text,
	`notes` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
