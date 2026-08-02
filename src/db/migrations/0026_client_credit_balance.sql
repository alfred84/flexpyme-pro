-- Saldo a favor del cliente (crédito) separado de la deuda abierta.
ALTER TABLE `clients` ADD COLUMN `credit_balance` real NOT NULL DEFAULT 0;
--> statement-breakpoint
-- Crédito aplicado / generado por pedido (para anulación coherente).
ALTER TABLE `invoices` ADD COLUMN `credit_applied` real NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `invoices` ADD COLUMN `credit_added` real NOT NULL DEFAULT 0;
--> statement-breakpoint
-- Backfill: balances negativos históricos pasan a crédito.
UPDATE `clients`
SET `credit_balance` = -`balance`,
    `balance` = 0
WHERE `balance` < 0;
