-- Mermas de material durante la producción de un pedido.
-- El costo se guarda como snapshot (CUP/USD independientes); no altera el precio al cliente.
CREATE TABLE IF NOT EXISTS `invoice_material_wastes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer NOT NULL REFERENCES `invoices`(`id`),
	`inventory_item_id` integer NOT NULL REFERENCES `inventory_items`(`id`),
	`quantity` real NOT NULL,
	`reason_code` text NOT NULL,
	`reason_label` text NOT NULL,
	`notes` text,
	`cost_per_unit_cup` real DEFAULT 0 NOT NULL,
	`cost_per_unit_usd` real DEFAULT 0 NOT NULL,
	`cost_cup` real DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`inventory_movement_id` integer REFERENCES `inventory_movements`(`id`),
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `invoice_material_wastes_invoice_idx`
	ON `invoice_material_wastes` (`invoice_id`);
