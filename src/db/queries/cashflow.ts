import { invoke } from "@tauri-apps/api/core";
import type {
  CashBalanceDto,
  CashDailyPointDto,
  CashFilters,
  CashTransactionDto,
  CreateTransactionPayload,
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
 * Creates a manual cash transaction; returns the new id.
 */
export async function createCashTransaction(payload: CreateTransactionPayload): Promise<number> {
  return invoke<number>("cash_transaction_create", { payload });
}
