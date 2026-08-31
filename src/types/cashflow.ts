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

/**
 * Una denominación en el control de efectivo del mes.
 */
export interface CashControlLineDto {
  denomination: number;
  openingQty: number;
  inQty: number;
  outQty: number;
  estimatedQty: number;
  openingSubtotal: number;
  estimatedSubtotal: number;
}

/**
 * Resumen de control de efectivo para una moneda (CUP o USD).
 */
export interface CashControlCurrencyDto {
  currency: "CUP" | "USD";
  hasOpening: boolean;
  openingTotal: number;
  inTotal: number;
  outTotal: number;
  estimatedTotal: number;
  ledgerBalance: number;
  lines: CashControlLineDto[];
}

/**
 * Vista de control de efectivo para un mes calendario (`YYYY-MM`).
 */
export interface CashControlSummaryDto {
  month: string;
  selectedDay: string | null;
  openingUpdatedAt: string | null;
  notes: string | null;
  cup: CashControlCurrencyDto;
  usd: CashControlCurrencyDto;
  dayCup: CashControlCurrencyDto | null;
  dayUsd: CashControlCurrencyDto | null;
  dayNotes: string | null;
  dayOpeningUpdatedAt: string | null;
  days: CashControlDayDto[];
}

/**
 * Totales de un día del mes (estimado al cierre de ese día).
 */
export interface CashControlDayDto {
  date: string;
  inTotalCup: number;
  outTotalCup: number;
  estimatedTotalCup: number;
  inTotalUsd: number;
  outTotalUsd: number;
  estimatedTotalUsd: number;
  hasMovement: boolean;
  hasDeclaredOpening: boolean;
}

/**
 * Payload para registrar o actualizar el saldo inicial del mes.
 */
export interface SaveCashOpeningPayload {
  month: string;
  countsCup: Record<string, number>;
  countsUsd: Record<string, number>;
  notes?: string | null;
}

/**
 * Payload para registrar o actualizar el saldo inicial de un día.
 */
export interface SaveCashDayOpeningPayload {
  day: string;
  countsCup: Record<string, number>;
  countsUsd: Record<string, number>;
  notes?: string | null;
}
