/** Umbral para importes casi cero. */
const EPS = 1e-3;

/**
 * Datos mínimos de un pedido/factura para derivar montos reales de cobro.
 */
export interface InvoiceDualAmountsSource {
  total: number;
  paid: number;
  balance: number;
  totalUsd?: number | null;
  paidUsd?: number | null;
  balanceUsd?: number | null;
  dueUsd?: number | null;
  dueCup?: number | null;
  paymentCurrency?: string | null;
  exchangeRateSnapshot?: number | null;
}

/**
 * Montos reales a cobrar / cobrados / pendientes por moneda (sin convertir con tasa de app).
 */
export interface InvoiceDualAmounts {
  dueCup: number;
  dueUsd: number;
  paidCup: number;
  paidUsd: number;
  balanceCup: number;
  balanceUsd: number;
  rate: number;
  currency: string;
}

/**
 * Indica si un importe debe mostrarse.
 *
 * @param value - Importe.
 * @returns `true` si es materialmente distinto de cero.
 */
export function hasInvoiceAmount(value: number): boolean {
  return Math.abs(value) > EPS;
}

/**
 * Formatea un importe de factura o `—` si es vacío.
 *
 * @param value - Importe.
 * @param formatAbs - Formateador del valor absoluto.
 * @returns Texto.
 */
export function formatInvoiceAmountOrDash(
  value: number,
  formatAbs: (n: number) => string,
): string {
  return hasInvoiceAmount(value) ? formatAbs(value) : "—";
}

/**
 * Deriva due / paid / balance en CUP y USD a partir de columnas duales del pedido.
 *
 * @param inv - Cabecera o fila de factura.
 * @returns Montos físicos por moneda.
 */
export function resolveInvoiceDualAmounts(inv: InvoiceDualAmountsSource): InvoiceDualAmounts {
  const currency = (inv.paymentCurrency ?? "cup").toLowerCase();
  const rate =
    inv.exchangeRateSnapshot && inv.exchangeRateSnapshot > 0 ? inv.exchangeRateSnapshot : 0;
  const paidUsd = inv.paidUsd ?? 0;
  const balanceUsd = inv.balanceUsd ?? 0;

  let dueUsd = inv.dueUsd ?? 0;
  let dueCup = inv.dueCup ?? 0;
  if (!hasInvoiceAmount(dueUsd) && !hasInvoiceAmount(dueCup)) {
    if (currency === "usd") {
      dueUsd =
        inv.totalUsd && inv.totalUsd > 0
          ? inv.totalUsd
          : rate > 0
            ? inv.total / rate
            : 0;
      dueCup = 0;
    } else if (currency === "mixto") {
      dueUsd = inv.totalUsd ?? 0;
      dueCup = inv.total;
    } else {
      dueUsd = 0;
      dueCup = inv.total;
    }
  } else if (!hasInvoiceAmount(dueCup) && currency !== "usd") {
    dueCup = inv.total;
  }

  const paidCup =
    rate > 0
      ? Math.max(0, inv.paid - paidUsd * rate)
      : currency === "usd"
        ? 0
        : inv.paid;

  const balanceCup =
    rate > 0
      ? Math.max(0, inv.balance - balanceUsd * rate)
      : currency === "usd"
        ? 0
        : inv.balance;

  return {
    dueCup,
    dueUsd,
    paidCup,
    paidUsd,
    balanceCup,
    balanceUsd,
    rate,
    currency,
  };
}
