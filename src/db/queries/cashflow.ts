import { invoke } from "@tauri-apps/api/core";
import type {
  CashBalanceDto,
  CashControlSummaryDto,
  CashDailyPointDto,
  CashFilters,
  CashNetSummaryDto,
  CashTransactionDto,
  CreateTransactionPayload,
  SaveCashDayOpeningPayload,
  SaveCashOpeningPayload,
} from "@/types/cashflow";

/**
 * Loads the current cash balance (CUP and USD).
 */
export async function fetchCashBalance(): Promise<CashBalanceDto> {
  return invoke<CashBalanceDto>("cash_balance");
}

/**
 * Lists cash transactions with optional filters.
 */
export async function fetchCashTransactions(filters?: CashFilters): Promise<CashTransactionDto[]> {
  return invoke<CashTransactionDto[]>("cash_transactions_list", { filters: filters ?? null });
}

/**
 * Loads the 30-day net cash-flow series.
 */
export async function fetchCashDailySeries(): Promise<CashDailyPointDto[]> {
  return invoke<CashDailyPointDto[]>("cash_daily_series");
}

/**
 * Loads the net cash flow for today and the current month.
 */
export async function fetchCashNetSummary(): Promise<CashNetSummaryDto> {
  return invoke<CashNetSummaryDto>("cash_net_summary");
}

/**
 * Creates a manual cash transaction; returns the new id.
 */
export async function createCashTransaction(payload: CreateTransactionPayload): Promise<number> {
  return invoke<number>("cash_transaction_create", { payload });
}

/**
 * Carga el control de efectivo del mes y, si se indica, el detalle de un día.
 *
 * @param month - Mes calendario (`YYYY-MM`).
 * @param day - Día opcional (`YYYY-MM-DD`) para el monitoreo diario.
 * @returns Resumen CUP y USD del mes (y del día si aplica).
 */
export async function fetchCashControlSummary(
  month: string,
  day?: string | null,
): Promise<CashControlSummaryDto> {
  return invoke<CashControlSummaryDto>("cash_control_summary", {
    month,
    day: day ?? null,
  });
}

/**
 * Guarda el conteo físico de billetes al inicio del mes.
 *
 * @param payload - Mes, conteos CUP/USD y notas opcionales.
 */
export async function saveCashMonthOpening(payload: SaveCashOpeningPayload): Promise<void> {
  await invoke("cash_month_opening_save", { payload });
}

/**
 * Guarda el conteo físico de billetes al inicio del día.
 *
 * @param payload - Día ISO, conteos CUP/USD y notas opcionales.
 */
export async function saveCashDayOpening(payload: SaveCashDayOpeningPayload): Promise<void> {
  await invoke("cash_day_opening_save", { payload });
}
