import type { SaleCurrency } from "@/lib/currency";

/**
 * Formato de importes con separadores en español y prefijo `$`.
 */
const amountFormatter = new Intl.NumberFormat("es", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Moneda del importe (libro contable o precio de venta). */
export type MoneyCurrency = SaleCurrency;

/**
 * Formatea solo el importe (`$ 1.234,56`), sin código de moneda.
 * Usar cuando la moneda ya está en la etiqueta, columna o encabezado.
 *
 * @param value - Importe numérico.
 * @returns Texto listo para UI, p. ej. `$ 1.234,56`.
 */
export function formatAmount(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  return `$ ${amountFormatter.format(amount)}`;
}

/**
 * Añade la moneda al texto de una etiqueta o encabezado.
 *
 * @param label - Texto base, p. ej. `Facturación del mes`.
 * @param currency - Moneda (`CUP` | `USD`).
 * @returns Etiqueta con moneda, p. ej. `Facturación del mes (CUP)`.
 */
export function moneyHeading(label: string, currency: MoneyCurrency = "CUP"): string {
  return `${label} (${currency})`;
}

/**
 * Formatea un importe con código de moneda para contextos sin encabezado
 * (mensajes, badges, tooltips, líneas mixtas CUP/USD).
 *
 * @param value - Importe numérico.
 * @param currency - Moneda del importe (`CUP` | `USD`).
 * @returns Texto con moneda, p. ej. `$ 1.234,56 CUP`.
 */
export function formatMoney(value: number, currency: MoneyCurrency = "CUP"): string {
  return `${formatAmount(value)} ${currency}`;
}
