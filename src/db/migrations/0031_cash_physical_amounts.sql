-- Caja física dual: quitar equivalentes CUP escritos en movimientos/gastos USD-solo.
-- No tocar cobros de pedido (`reference_type = 'pedido'`), que ya guardan neto físico por moneda.

-- Movimientos de caja (manuales / otros) donde amount_cup ≈ amount_usd × tasa.
UPDATE `cash_transactions`
SET `amount_cup` = 0
WHERE COALESCE(`amount_usd`, 0) > 0.001
  AND COALESCE(`exchange_rate`, 0) > 0.001
  AND ABS(`amount_cup` - (`amount_usd` * `exchange_rate`)) < 0.05
  AND LOWER(COALESCE(`reference_type`, '')) != 'pedido';

-- Otros gastos USD-solo: amount_cup era el equivalente contable (tasa típica ≫ 1).
UPDATE `other_expenses`
SET `amount_cup` = 0
WHERE COALESCE(`amount_usd`, 0) > 0.001
  AND COALESCE(`amount_cup`, 0) > 0.001
  AND (`amount_cup` / `amount_usd`) >= 10;

-- Sincronizar egreso de caja enlazado tras limpiar otros gastos.
UPDATE `cash_transactions`
SET `amount_cup` = 0
WHERE `id` IN (
  SELECT `cash_transaction_id` FROM `other_expenses`
  WHERE `cash_transaction_id` IS NOT NULL
    AND COALESCE(`amount_usd`, 0) > 0.001
    AND COALESCE(`amount_cup`, 0) < 0.001
)
AND LOWER(COALESCE(`reference_type`, '')) != 'pedido';
