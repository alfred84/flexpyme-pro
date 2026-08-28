-- Ventas de material de inventario (salida de stock + ingreso en flujo de caja).
-- Los importes CUP y USD son cajones físicos independientes; la tasa es solo auditoría.
CREATE TABLE IF NOT EXISTS `inventory_material_sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`inventory_item_id` integer NOT NULL REFERENCES `inventory_items`(`id`),
	`quantity` real NOT NULL,
	`unit_snapshot` text,
	`sale_amount_cup` real DEFAULT 0 NOT NULL,
	`sale_amount_usd` real DEFAULT 0 NOT NULL,
	`payment_currency` text NOT NULL,
	`payment_method` text NOT NULL,
	`exchange_rate` real DEFAULT 0 NOT NULL,
	`denomination_breakdown` text,
	`notes` text,
	`inventory_movement_id` integer REFERENCES `inventory_movements`(`id`),
	`cash_transaction_id` integer REFERENCES `cash_transactions`(`id`),
	`date` text DEFAULT (datetime('now')) NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `inventory_material_sales_item_idx`
	ON `inventory_material_sales` (`inventory_item_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `inventory_material_sales_movement_idx`
	ON `inventory_material_sales` (`inventory_movement_id`);
