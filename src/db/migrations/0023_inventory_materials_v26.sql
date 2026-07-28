-- Categorías de materiales de inventario (catálogo configurable).
CREATE TABLE IF NOT EXISTS `inventory_material_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `inventory_material_categories_name_unique`
	ON `inventory_material_categories` (`name`);
--> statement-breakpoint
-- Migra categorías free-text existentes al catálogo.
INSERT OR IGNORE INTO `inventory_material_categories` (`name`, `sort_order`, `is_active`)
SELECT DISTINCT trim(category), 10, 1
FROM `inventory_items`
WHERE category IS NOT NULL AND trim(category) <> '';
--> statement-breakpoint
ALTER TABLE `inventory_items` ADD COLUMN `material_category_id` integer REFERENCES `inventory_material_categories`(`id`);
--> statement-breakpoint
UPDATE `inventory_items`
SET `material_category_id` = (
	SELECT c.id FROM `inventory_material_categories` c
	WHERE lower(c.name) = lower(trim(inventory_items.category))
	LIMIT 1
)
WHERE `material_category_id` IS NULL
  AND category IS NOT NULL AND trim(category) <> '';
--> statement-breakpoint
-- Normas: tipo de trabajo, formato y acabado.
ALTER TABLE `inventory_recipes` ADD COLUMN `work_type_id` integer REFERENCES `work_types`(`id`);
--> statement-breakpoint
ALTER TABLE `inventory_recipes` ADD COLUMN `format_id` integer REFERENCES `formats`(`id`);
--> statement-breakpoint
ALTER TABLE `inventory_recipes` ADD COLUMN `finish` text;
--> statement-breakpoint
-- Materiales asignados por línea de pedido (norma o manual).
CREATE TABLE IF NOT EXISTS `invoice_item_materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_item_id` integer NOT NULL REFERENCES `invoice_items`(`id`) ON DELETE CASCADE,
	`inventory_item_id` integer NOT NULL REFERENCES `inventory_items`(`id`),
	`quantity_per_unit` real DEFAULT 1 NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`recipe_id` integer REFERENCES `inventory_recipes`(`id`) ON DELETE SET NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `invoice_item_materials_item_idx`
	ON `invoice_item_materials` (`invoice_item_id`);
