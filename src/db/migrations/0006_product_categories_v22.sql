ALTER TABLE `product_categories` ADD `code` text;--> statement-breakpoint
ALTER TABLE `product_categories` ADD `description` text;--> statement-breakpoint
ALTER TABLE `product_categories` ADD `icon` text;--> statement-breakpoint
ALTER TABLE `product_categories` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `product_categories` ADD `is_active` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `product_categories` ADD `is_system` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `product_categories` ADD `created_at` text;--> statement-breakpoint
ALTER TABLE `product_categories` ADD `updated_at` text;--> statement-breakpoint
UPDATE `product_categories` SET `created_at` = datetime('now'), `updated_at` = datetime('now') WHERE `created_at` IS NULL;--> statement-breakpoint
UPDATE `product_categories` SET `code` = `name` WHERE `code` IS NULL;--> statement-breakpoint
UPDATE `product_categories` SET `name` = COALESCE(`label_es`, `name`) WHERE `label_es` IS NOT NULL AND trim(`label_es`) != '';--> statement-breakpoint
UPDATE `product_categories` SET `sort_order` = `id`, `is_system` = 1, `is_active` = 1;--> statement-breakpoint
UPDATE `product_categories` SET `icon` = 'Image' WHERE `code` = 'fotos';--> statement-breakpoint
UPDATE `product_categories` SET `icon` = 'Layers' WHERE `code` = 'lienzo';--> statement-breakpoint
UPDATE `product_categories` SET `icon` = 'BookOpen' WHERE `code` = 'revista';--> statement-breakpoint
UPDATE `product_categories` SET `icon` = 'Album' WHERE `code` = 'album';--> statement-breakpoint
UPDATE `product_categories` SET `icon` = 'Box' WHERE `code` = 'caja';--> statement-breakpoint
UPDATE `product_categories` SET `icon` = 'Type' WHERE `code` = 'titulo';--> statement-breakpoint
UPDATE `product_categories` SET `icon` = 'Book' WHERE `code` = 'book';--> statement-breakpoint
UPDATE `product_categories` SET `icon` = 'RectangleHorizontal' WHERE `code` = 'lona';--> statement-breakpoint
UPDATE `product_categories` SET `icon` = 'Key' WHERE `code` = 'llavero';--> statement-breakpoint
CREATE UNIQUE INDEX `product_categories_code_unique` ON `product_categories` (`code`);--> statement-breakpoint
ALTER TABLE `invoice_items` ADD `category_snapshot` text;--> statement-breakpoint
UPDATE `invoice_items` SET `category_snapshot` = (
  SELECT COALESCE(`label_es`, `name`) FROM `product_categories` WHERE `id` = `invoice_items`.`category_id`
) WHERE `category_snapshot` IS NULL;
