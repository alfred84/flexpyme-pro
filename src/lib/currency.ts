/**
 * Moneda por defecto para precios de venta y cobros en efectivo.
 * El libro contable del pedido sigue resolviéndose en CUP (vía tasa).
 */
export const DEFAULT_SALE_CURRENCY = "USD" as const;

/**
 * Moneda por defecto al cobrar / anticipar en efectivo.
 * Transferencia sigue forzando CUP en la UI de pedidos.
 */
export const DEFAULT_PAYMENT_CURRENCY = "USD" as const;

export type SaleCurrency = "CUP" | "USD";

/**
 * Redondea un importe a 2 decimales (centavos).
 *
 * @param value - Importe.
 * @returns Valor redondeado.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

/**
 * Convierte un importe CUP a USD con la tasa aplicada.
 *
 * @param amountCup - Importe en CUP.
 * @param rate - Tasa USD→CUP (`1 USD = rate CUP`).
 * @returns Importe en USD, o `0` si la tasa no es usable.
 */
export function cupToUsd(amountCup: number, rate: number): number {
  if (!(rate > 0) || !Number.isFinite(amountCup)) {
    return 0;
  }
  return roundMoney(amountCup / rate);
}

/**
 * Convierte un importe USD a CUP con la tasa aplicada.
 *
 * @param amountUsd - Importe en USD.
 * @param rate - Tasa USD→CUP (`1 USD = rate CUP`).
 * @returns Importe en CUP, o `0` si la tasa no es usable.
 */
export function usdToCup(amountUsd: number, rate: number): number {
  if (!(rate > 0) || !Number.isFinite(amountUsd)) {
    return 0;
  }
  return roundMoney(amountUsd * rate);
}
