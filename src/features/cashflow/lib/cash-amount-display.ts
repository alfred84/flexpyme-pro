import { formatAmount } from "@/lib/format-money";

/** Umbral para tratar importes casi cero como vacíos. */
export const CASH_AMOUNT_EPS = 1e-3;

/**
 * Indica si un importe de caja es materialmente distinto de cero.
 *
 * @param value - Importe.
 * @returns `true` si debe mostrarse.
 */
export function hasCashAmount(value: number): boolean {
  return Math.abs(value) > CASH_AMOUNT_EPS;
}

/**
 * Formatea un importe de caja con signo según ingreso/egreso.
 *
 * @param absoluteAmount - Valor absoluto (>= 0).
 * @param isIncome - `true` si es ingreso.
 * @returns Texto con signo, o `—` si ≈ 0.
 */
export function formatSignedCashAmount(absoluteAmount: number, isIncome: boolean): string {
  if (!hasCashAmount(absoluteAmount)) {
    return "—";
  }
  const sign = isIncome ? "+" : "−";
  return `${sign}${formatAmount(Math.abs(absoluteAmount))}`;
}

/**
 * Clase de color para importe de ingreso/egreso (o neutro si vacío).
 *
 * @param absoluteAmount - Valor absoluto.
 * @param isIncome - Tipo de movimiento.
 * @returns Clases CSS.
 */
export function cashAmountClassName(absoluteAmount: number, isIncome: boolean): string {
  if (!hasCashAmount(absoluteAmount)) {
    return "tabular-nums text-base-content/40";
  }
  return isIncome
    ? "tabular-nums font-medium text-success"
    : "tabular-nums font-medium text-error";
}

/**
 * Formatea un neto (puede ser negativo) con signo y color.
 *
 * @param net - Neto (positivo = ingreso neto).
 * @returns Texto, clase y si es vacío.
 */
export function formatCashNet(net: number): {
  text: string;
  className: string;
} {
  if (!hasCashAmount(net)) {
    return {
      text: formatAmount(0),
      className: "tabular-nums text-base-content/70",
    };
  }
  const sign = net >= 0 ? "+" : "−";
  return {
    text: `${sign}${formatAmount(Math.abs(net))}`,
    className:
      net >= 0
        ? "tabular-nums font-semibold text-success"
        : "tabular-nums font-semibold text-error",
  };
}
