import { invoke } from "@tauri-apps/api/core";
import type {
  CreateInvoicePayload,
  CreateInvoiceResponse,
  InvoiceDetailDto,
  InvoiceHeaderDto,
  InvoiceListDto,
  InvoiceMetricsDto,
  InvoicePaymentHistoryRow,
  UpdateInvoicePayload,
} from "@/types/invoice";

/**
 * Lists all non-deleted invoices with client name.
 */
export async function fetchInvoices(): Promise<InvoiceListDto[]> {
  return invoke<InvoiceListDto[]>("invoices_list");
}

/**
 * Lista facturas para el módulo financiero (incluye anuladas).
 */
export async function fetchInvoicesFinancial(): Promise<InvoiceListDto[]> {
  return invoke<InvoiceListDto[]>("invoices_financial_list");
}

/**
 * KPIs del módulo Facturas.
 */
export async function fetchInvoiceMetrics(): Promise<InvoiceMetricsDto> {
  return invoke<InvoiceMetricsDto>("get_invoice_metrics");
}

/**
 * Historial de pagos de una factura.
 */
export async function fetchInvoicePaymentHistory(invoiceId: number): Promise<InvoicePaymentHistoryRow[]> {
  return invoke<InvoicePaymentHistoryRow[]>("get_invoice_payment_history", { invoiceId });
}

/**
 * Anula una factura con motivo obligatorio.
 */
export async function cancelInvoice(invoiceId: number, reason: string): Promise<InvoiceHeaderDto> {
  return invoke<InvoiceHeaderDto>("cancel_invoice", { invoiceId, reason });
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

/**
 * Updates an editable order (client, date, notes, lines).
 */
export async function updateInvoice(payload: UpdateInvoicePayload): Promise<InvoiceHeaderDto> {
  return invoke<InvoiceHeaderDto>("invoices_update", { payload });
}

/**
 * Marca el pedido como listo en producción.
 */
export async function updateInvoiceProductionStatus(id: number, status: string): Promise<InvoiceHeaderDto> {
  return invoke<InvoiceHeaderDto>("invoices_update_production_status", { id, status });
}

/**
 * Actualiza el estado de cobro del pedido.
 */
export async function updateInvoicePaymentStatus(id: number, status: string): Promise<InvoiceHeaderDto> {
  return invoke<InvoiceHeaderDto>("invoices_update_payment_status", { id, status });
}
