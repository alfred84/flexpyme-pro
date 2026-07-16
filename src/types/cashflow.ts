/**
 * Balance de caja por moneda.
 */
export interface CashBalanceDto {
  balanceCup: number;
  balanceUsd: number;
  totalIncomeCup: number;
  totalExpenseCup: number;
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
 * Punto de la serie diaria de flujo de caja.
 */
export interface CashDailyPointDto {
  date: string;
  netCup: number;
}

/**
 * Flujo neto del día actual y del mes en curso.
 */
export interface CashNetSummaryDto {
  netTodayCup: number;
  netTodayUsd: number;
  netMonthCup: number;
  netMonthUsd: number;
}

/**
 * Filtros para el historial de caja.
 */
export interface CashFilters {
  dateFrom?: string | null;
  dateTo?: string | null;
  transactionType?: string | null;
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
