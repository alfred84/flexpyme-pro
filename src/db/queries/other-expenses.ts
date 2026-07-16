import { invoke } from "@tauri-apps/api/core";
import type {
  CreateOtherExpensePayload,
  OtherExpenseDto,
  OtherExpenseSummaryDto,
} from "@/types/other-expense";

/**
 * Lists other operating expenses (most recent first).
 */
export async function fetchOtherExpenses(): Promise<OtherExpenseDto[]> {
  return invoke<OtherExpenseDto[]>("other_expenses_list");
}

/**
 * Loads net other-expense totals for the current day and month.
 */
export async function fetchOtherExpensesSummary(): Promise<OtherExpenseSummaryDto> {
  return invoke<OtherExpenseSummaryDto>("other_expenses_summary");
}

/**
 * Registers an other expense (creates a matching cash egress).
 */
export async function createOtherExpense(payload: CreateOtherExpensePayload): Promise<number> {
  return invoke<number>("other_expense_create", { payload });
}

/**
 * Deletes an other expense and its linked cash transaction.
 */
export async function deleteOtherExpense(id: number): Promise<void> {
  return invoke<void>("other_expense_delete", { id });
}
