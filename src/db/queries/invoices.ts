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
  UpdateInvoicePaymentConfigPayload,
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
 * Actualiza método/moneda/tasa/due de un pedido sin cobros.
 *
 * @param payload - Nueva forma de pago.
 * @returns Cabecera actualizada.
 */
export async function updateInvoicePaymentConfig(
  payload: UpdateInvoicePaymentConfigPayload,
): Promise<InvoiceHeaderDto> {
  return invoke<InvoiceHeaderDto>("invoices_update_payment_config", { payload });
}

/**
 * Marca el pedido como listo en producción.
 */
export async function updateInvoiceProductionStatus(id: number, status: string): Promise<InvoiceHeaderDto> {
  return invoke<InvoiceHeaderDto>("invoices_update_production_status", { id, status });
}

/**
 * Trabajador confirmado al marcar una línea como listo.
 */
export interface MarkListoWorkerPayload {
  employeeId: number;
  quantity: number;
  unitCost: number;
}

/**
 * Marca una línea de pedido como listo creando lotes de producción.
 *
 * @param payload - Línea, fecha y trabajadores con cantidades/tarifas.
 */
export async function markInvoiceItemListo(payload: {
  invoiceItemId: number;
  date: string;
  workers: MarkListoWorkerPayload[];
}): Promise<InvoiceDetailDto> {
  return invoke<InvoiceDetailDto>("invoice_item_mark_listo", { payload });
}

/**
 * Marca todas las líneas pendientes del pedido como listo (defaults).
 *
 * @param invoiceId - Id del pedido.
 * @param date - Fecha de los lotes.
 */
export async function markInvoiceAllListo(
  invoiceId: number,
  date: string,
): Promise<InvoiceDetailDto> {
  return invoke<InvoiceDetailDto>("invoice_mark_all_listo", { invoiceId, date });
}

/**
 * Actualiza el estado de cobro del pedido.
 */
export async function updateInvoicePaymentStatus(id: number, status: string): Promise<InvoiceHeaderDto> {
  return invoke<InvoiceHeaderDto>("invoices_update_payment_status", { id, status });
}
