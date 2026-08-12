-- Costo unitario opcional en USD (independiente del costo en CUP; sin conversión forzada).
ALTER TABLE `inventory_items` ADD `cost_per_unit_usd` real NOT NULL DEFAULT 0;
