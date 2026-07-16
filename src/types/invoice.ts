/**
 * Invoice row for list screens.
 */
export interface InvoiceListDto {
  id: number;
  invoiceNumber: string;
  clientId: number;
  clientName: string;
  date: string;
  total: number;
  paid: number;
  balance: number;
  status: string;
  productionStatus: string;
  paymentStatus: string;
}

/**
 * Invoice header for detail view.
 */
export interface InvoiceHeaderDto {
  id: number;
  invoiceNumber: string;
  clientId: number;
  clientName: string;
  date: string;
  subtotal: number;
  advancePayment: number;
  previousDebt: number;
  total: number;
  paid: number;
  balance: number;
  status: string;
  productionStatus: string;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentCurrency: string | null;
  exchangeRateSnapshot: number | null;
  amountUsd: number;
  amountCup: number;
  notes: string | null;
  resourceMissing: boolean;
  cancelledAt: string | null;
  cancelledReason: string | null;
}

/**
 * Pago registrado en caja vinculado a una factura.
 */
export interface InvoicePaymentHistoryRow {
  id: number;
  date: string;
  concept: string;
  amountCup: number;
  amountUsd: number;
  paymentMethod: string;
}

/**
 * KPIs del módulo Facturas.
 */
export interface InvoiceMetricsDto {
  totalAmount: number;
  totalCount: number;
  cobradasAmount: number;
  cobradasCount: number;
  parcialesAmount: number;
  parcialesCount: number;
  pendientesAmount: number;
  pendientesCount: number;
  anuladasCount: number;
}

/**
 * Invoice line with joined labels.
 */
export interface InvoiceItemDto {
  id: number;
  categoryId: number;
  categoryName: string;
  formatId: number | null;
  formatLabel: string | null;
  finish: string | null;
  service: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  completedQuantity: number;
  resourceMissing: boolean;
  resourceNote: string | null;
}

/**
 * Full invoice with lines.
 */
export interface InvoiceDetailDto {
  invoice: InvoiceHeaderDto;
  items: InvoiceItemDto[];
}

/**
 * Line payload for creating an invoice.
 */
export interface CreateInvoiceItemPayload {
  categoryId: number;
  formatId: number | null;
  finish: string | null;
  service: string | null;
  quantity: number;
  unitPrice: number;
}

/**
 * Cobro inicial al crear un pedido (misma forma que caja, sin invoiceId).
 */
export interface InitialPaymentPayload {
  counts?: Record<string, number> | null;
  amountCup?: number | null;
  amountUsd?: number | null;
  exchangeRate?: number | null;
  transferConcept?: string | null;
  changeCounts?: Record<string, number> | null;
}

/**
 * Payload for creating an invoice with lines.
 */
export type PaymentMethod = "efectivo" | "transferencia";
export type PaymentCurrency = "CUP" | "USD";

export interface CreateInvoicePayload {
  clientId: number;
  date: string;
  notes?: string | null;
  advancePayment: number;
  paid: number;
  paymentMethod: PaymentMethod;
  paymentCurrency: PaymentCurrency;
  exchangeRateSnapshot: number;
  transferConcept?: string | null;
  initialPayment?: InitialPaymentPayload | null;
  items: CreateInvoiceItemPayload[];
}

/**
 * Response after successful invoice creation.
 */
export interface CreateInvoiceResponse {
  id: number;
  invoiceNumber: string;
}
