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
