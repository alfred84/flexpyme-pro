import type { SaleCurrency } from "@/lib/currency";

/**
 * Formato de importes con separadores en español, prefijo `$` y etiqueta de moneda.
 */
const amountFormatter = new Intl.NumberFormat("es", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Moneda mostrada junto al importe (libro contable o precio de venta). */
export type MoneyCurrency = SaleCurrency;

/**
 * Formatea un importe monetario indicando siempre la moneda.
 *
 * Por defecto usa CUP (totales de pedido, caja neta, salarios y tarifas).
 * Pasa `"USD"` cuando el valor está expresado en dólares.
 *
 * @param value - Importe numérico.
 * @param currency - Moneda del importe (`CUP` | `USD`).
 * @returns Texto listo para UI, p. ej. `$ 1.234,56 CUP`.
 */
export function formatMoney(value: number, currency: MoneyCurrency = "CUP"): string {
  const amount = Number.isFinite(value) ? value : 0;
  return `$ ${amountFormatter.format(amount)} ${currency}`;
}
