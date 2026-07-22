CREATE TABLE IF NOT EXISTS `finishes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`is_system` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `finishes_name_unique` ON `finishes` (`name`);
--> statement-breakpoint
INSERT OR IGNORE INTO `finishes` (`name`, `description`, `is_active`, `is_system`) VALUES
	('Brillo', 'Acabado fotográfico estándar', 1, 1),
	('3D', 'Acabado 3D', 1, 1),
	('Diamantado', 'Acabado diamantado', 1, 1),
	('Cuero Acrílico', 'Acabado cuero acrílico (fotobooks)', 1, 1);
--> statement-breakpoint
INSERT OR IGNORE INTO `finishes` (`name`, `is_active`, `is_system`)
SELECT DISTINCT trim(cf.finish), 1, 0
FROM `category_finishes` cf
WHERE cf.finish IS NOT NULL AND trim(cf.finish) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM `finishes` f WHERE lower(f.name) = lower(trim(cf.finish))
  );
--> statement-breakpoint
INSERT OR IGNORE INTO `finishes` (`name`, `is_active`, `is_system`)
SELECT DISTINCT trim(pl.finish), 1, 0
FROM `price_list` pl
WHERE pl.finish IS NOT NULL AND trim(pl.finish) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM `finishes` f WHERE lower(f.name) = lower(trim(pl.finish))
  );
