-- Dualidad monetaria: precios USD en línea, saldos duales, split Mixto, vuelto USD.
ALTER TABLE `invoice_items` ADD `unit_price_usd` real NOT NULL DEFAULT 0;

ALTER TABLE `invoices` ADD `total_usd` real NOT NULL DEFAULT 0;
ALTER TABLE `invoices` ADD `paid_usd` real NOT NULL DEFAULT 0;
ALTER TABLE `invoices` ADD `balance_usd` real NOT NULL DEFAULT 0;
ALTER TABLE `invoices` ADD `due_usd` real NOT NULL DEFAULT 0;
ALTER TABLE `invoices` ADD `due_cup` real NOT NULL DEFAULT 0;

ALTER TABLE `cash_sessions` ADD `amount_received_usd` real NOT NULL DEFAULT 0;
ALTER TABLE `cash_sessions` ADD `change_given_usd` real NOT NULL DEFAULT 0;
ALTER TABLE `cash_sessions` ADD `denomination_breakdown_usd` text;
ALTER TABLE `cash_sessions` ADD `change_breakdown_usd` text;

-- Backfill: unit_price_usd desde CUP / tasa del pedido (si hay tasa).
UPDATE invoice_items
SET unit_price_usd = CASE
  WHEN COALESCE((
    SELECT i.exchange_rate_snapshot FROM invoices i WHERE i.id = invoice_items.invoice_id
  ), 0) > 0
  THEN invoice_items.unit_price / (
    SELECT i.exchange_rate_snapshot FROM invoices i WHERE i.id = invoice_items.invoice_id
  )
  ELSE 0
END
WHERE COALESCE(unit_price_usd, 0) = 0 AND unit_price > 0;

-- Backfill totales duales desde columnas existentes.
UPDATE invoices
SET total_usd = CASE
      WHEN COALESCE(exchange_rate_snapshot, 0) > 0 THEN total / exchange_rate_snapshot
      ELSE COALESCE(amount_usd, 0)
    END,
    paid_usd = CASE
      WHEN COALESCE(exchange_rate_snapshot, 0) > 0 AND UPPER(COALESCE(payment_currency, '')) = 'USD'
        THEN paid / exchange_rate_snapshot
      ELSE 0
    END,
    balance_usd = CASE
      WHEN COALESCE(exchange_rate_snapshot, 0) > 0 AND UPPER(COALESCE(payment_currency, '')) = 'USD'
        THEN balance / exchange_rate_snapshot
      ELSE 0
    END,
    due_usd = CASE
      WHEN UPPER(COALESCE(payment_currency, '')) = 'USD'
           AND COALESCE(exchange_rate_snapshot, 0) > 0
        THEN total / exchange_rate_snapshot
      ELSE 0
    END,
    due_cup = CASE
      WHEN UPPER(COALESCE(payment_currency, '')) = 'USD' THEN 0
      ELSE total
    END
WHERE COALESCE(total_usd, 0) = 0 AND COALESCE(due_cup, 0) = 0;
