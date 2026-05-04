import { invoke } from "@tauri-apps/api/core";
import type { CashierRegisterPayload, CashierRegisterResponse, CashSessionDto } from "@/types/cashier";

/**
 * Cash sessions for an invoice, newest first.
 */
export async function fetchCashSessionsForInvoice(invoiceId: number): Promise<CashSessionDto[]> {
  return invoke<CashSessionDto[]>("cashier_sessions_for_invoice", { invoice_id: invoiceId });
}

/**
 * Registers counted cash and updates invoice/client balances.
 */
export async function registerCashPayment(payload: CashierRegisterPayload): Promise<CashierRegisterResponse> {
  return invoke<CashierRegisterResponse>("cashier_register_payment", { payload });
}
