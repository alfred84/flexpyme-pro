import { invoke } from "@tauri-apps/api/core";
import type { CreateInvoicePayload, CreateInvoiceResponse, InvoiceDetailDto, InvoiceListDto } from "@/types/invoice";

/**
 * Lists all non-deleted invoices with client name.
 */
export async function fetchInvoices(): Promise<InvoiceListDto[]> {
  return invoke<InvoiceListDto[]>("invoices_list");
}

/**
 * Loads one invoice with line items.
 */
export async function fetchInvoiceDetail(id: number): Promise<InvoiceDetailDto> {
  return invoke<InvoiceDetailDto>("invoices_get_detail", { id });
}

/**
 * Creates an invoice and its line items in a single transaction.
 */
export async function createInvoice(payload: CreateInvoicePayload): Promise<CreateInvoiceResponse> {
  return invoke<CreateInvoiceResponse>("invoices_create", { payload });
}
