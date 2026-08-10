/**
 * Balance de caja por moneda (cajones físicos independientes).
 */
export interface CashBalanceDto {
  balanceCup: number;
  balanceUsd: number;
  totalIncomeCup: number;
  totalExpenseCup: number;
  totalIncomeUsd: number;
  totalExpenseUsd: number;
}

/**
 * Transacción de caja.
 */
export interface CashTransactionDto {
  id: number;
  transactionType: string;
  concept: string;
  referenceType: string | null;
  referenceId: number | null;
  amountCup: number;
  amountUsd: number;
  exchangeRate: number;
  paymentMethod: string;
  date: string;
}

/**
 * Punto de la serie diaria de flujo de caja (neto por moneda).
 */
export interface CashDailyPointDto {
  date: string;
  netCup: number;
  netUsd: number;
}

/**
 * Flujo neto del día actual y de los últimos 30 días.
 */
export interface CashNetSummaryDto {
  netTodayCup: number;
  netTodayUsd: number;
  net30DaysCup: number;
  net30DaysUsd: number;
}

/**
 * Filtros para el historial de caja.
 */
export interface CashFilters {
  dateFrom?: string | null;
  dateTo?: string | null;
  transactionType?: string | null;
  /** Subcadena de concepto. */
  concept?: string | null;
  /** `cup` | `usd` | `mixto` | vacío = todas. */
  currency?: string | null;
  paymentMethod?: string | null;
}

/**
 * Payload de creación de transacción manual de caja.
 */
export interface CreateTransactionPayload {
  transactionType: "ingreso" | "egreso";
  concept: string;
  referenceType: string | null;
  amountCup: number;
  amountUsd: number | null;
  exchangeRate: number | null;
  paymentMethod: "efectivo" | "transferencia";
  denominationBreakdown: string | null;
}
