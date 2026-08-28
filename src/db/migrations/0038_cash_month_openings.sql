-- Conteo de efectivo (denominaciones) al inicio de cada mes calendario.
CREATE TABLE IF NOT EXISTS `cash_month_openings` (
	`month` text PRIMARY KEY NOT NULL,
	`counts_cup` text,
	`counts_usd` text,
	`notes` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
