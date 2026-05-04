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
  notes: string | null;
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
 * Payload for creating an invoice with lines.
 */
export interface CreateInvoicePayload {
  clientId: number;
  date: string;
  notes?: string | null;
  advancePayment: number;
  paid: number;
  items: CreateInvoiceItemPayload[];
}

/**
 * Response after successful invoice creation.
 */
export interface CreateInvoiceResponse {
  id: number;
  invoiceNumber: string;
}
