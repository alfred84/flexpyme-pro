import { invoke } from "@tauri-apps/api/core";
import type {
  CreateOtherExpensePayload,
  OtherExpenseDto,
  OtherExpenseSummaryDto,
  UpdateOtherExpensePayload,
} from "@/types/other-expense";

/**
 * Lists other operating expenses (most recent first).
 */
export async function fetchOtherExpenses(): Promise<OtherExpenseDto[]> {
  return invoke<OtherExpenseDto[]>("other_expenses_list");
}

/**
 * Loads a single other expense by id.
 *
 * @param id - Identificador del gasto.
 * @returns Gasto con desglose y metadatos.
 */
export async function fetchOtherExpenseById(id: number): Promise<OtherExpenseDto> {
  return invoke<OtherExpenseDto>("other_expense_get_by_id", { id });
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
 * Updates an other expense and syncs its linked cash transaction.
 *
 * @param payload - Datos actualizados del gasto.
 */
export async function updateOtherExpense(payload: UpdateOtherExpensePayload): Promise<void> {
  return invoke<void>("other_expense_update", { payload });
}

/**
 * Deletes an other expense and its linked cash transaction.
 */
export async function deleteOtherExpense(id: number): Promise<void> {
  return invoke<void>("other_expense_delete", { id });
}
