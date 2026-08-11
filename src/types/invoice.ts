import type { InvoiceItemMaterialInput } from "@/types/inventory";

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
  totalUsd: number;
  paidUsd: number;
  balanceUsd: number;
  dueUsd: number;
  dueCup: number;
  status: string;
  productionStatus: string;
  paymentStatus: string;
  /** Moneda de cobro (`CUP` | `USD` | `mixto`). */
  paymentCurrency: string | null;
  /** Tasa USD→CUP del pedido. */
  exchangeRateSnapshot: number | null;
  /** True si el pedido aún se puede editar (sin trabajo iniciado). */
  canEdit: boolean;
  /** True si el pedido se puede anular (no cobrado al 100%). */
  canCancel: boolean;
  /** True si alguna línea abierta tiene material en déficit. */
  resourceMissing: boolean;
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
  totalUsd: number;
  paidUsd: number;
  balanceUsd: number;
  dueUsd: number;
  dueCup: number;
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
 * KPIs del módulo Facturas (montos reales de cobro por moneda).
 */
export interface InvoiceMetricsDto {
  totalAmountCup: number;
  totalAmountUsd: number;
  totalCount: number;
  cobradasAmountCup: number;
  cobradasAmountUsd: number;
  cobradasCount: number;
  parcialesAmountCup: number;
  parcialesAmountUsd: number;
  parcialesCount: number;
  pendientesAmountCup: number;
  pendientesAmountUsd: number;
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
  unitPriceUsd: number;
  unitPrice: number;
  subtotal: number;
  completedQuantity: number;
  resourceMissing: boolean;
  resourceNote: string | null;
  /** Estado productivo de la línea: `en_produccion` | `listo`. */
  productionLineStatus: string;
  materials: InvoiceItemMaterialDto[];
  assignments: InvoiceItemAssignmentDto[];
}

/**
 * Empleado asignado a una línea de pedido.
 */
export interface InvoiceItemAssignmentDto {
  employeeId: number;
  employeeName: string;
  customUnitCost: number | null;
}

/**
 * Material fijado en una línea de pedido.
 */
export interface InvoiceItemMaterialDto {
  inventoryItemId: number;
  quantityPerUnit: number;
  source: string;
  recipeId: number | null;
}

/**
 * Full invoice with lines.
 */
export interface InvoiceDetailDto {
  invoice: InvoiceHeaderDto;
  items: InvoiceItemDto[];
  canEdit: boolean;
  canCancel: boolean;
  editBlockReason: string | null;
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
  /** Precio unitario en USD (fuente de verdad). */
  unitPriceUsd: number;
  /** Precio unitario en CUP (derivado). */
  unitPrice: number;
  /** Materiales a descontar al concluir la línea (norma o asignación manual). */
  materials?: InvoiceItemMaterialInput[] | null;
  /** Empleados asignados al tipo de trabajo de la línea. */
  assignments?: CreateInvoiceItemAssignmentPayload[] | null;
}

/**
 * Asignación de empleado al crear/editar un ítem.
 */
export interface CreateInvoiceItemAssignmentPayload {
  employeeId: number;
  customUnitCost?: number | null;
}

/**
 * Payload para editar un pedido existente (sin alterar cobros registrados).
 */
export interface UpdateInvoicePayload {
  id: number;
  clientId: number;
  date: string;
  notes?: string | null;
  exchangeRateSnapshot?: number | null;
  paymentMethod?: PaymentMethod | null;
  paymentCurrency?: PaymentCurrency | null;
  dueUsd?: number | null;
  dueCup?: number | null;
  items: CreateInvoiceItemPayload[];
}

/**
 * Cambio de forma de pago en un pedido sin cobros ni anticipo.
 */
export interface UpdateInvoicePaymentConfigPayload {
  id: number;
  paymentMethod: PaymentMethod;
  paymentCurrency: PaymentCurrency;
  exchangeRateSnapshot: number;
  dueUsd?: number | null;
  dueCup?: number | null;
}

export type PaymentMethod = "efectivo" | "transferencia";
export type PaymentCurrency = "CUP" | "USD" | "mixto";

/** Qué hacer con el exceso recibido sobre el saldo. */
export type OverpaymentDisposition = "change" | "credit";

/**
 * Cobro inicial al crear un pedido (misma forma que caja, sin invoiceId).
 */
export interface InitialPaymentPayload {
  counts?: Record<string, number> | null;
  usdCounts?: Record<string, number> | null;
  amountCup?: number | null;
  amountUsd?: number | null;
  exchangeRate?: number | null;
  transferConcept?: string | null;
  changeCounts?: Record<string, number> | null;
  changeUsdCounts?: Record<string, number> | null;
  overpaymentDisposition?: OverpaymentDisposition | null;
  applyClientCredit?: boolean | null;
}

/**
 * Detalle del pago anticipado (método, moneda y denominaciones).
 */
export interface AdvancePaymentPayload {
  paymentMethod: PaymentMethod;
  paymentCurrency?: PaymentCurrency | null;
  counts?: Record<string, number> | null;
  usdCounts?: Record<string, number> | null;
  amountCup?: number | null;
  amountUsd?: number | null;
  exchangeRate?: number | null;
  transferConcept?: string | null;
  changeCounts?: Record<string, number> | null;
  changeUsdCounts?: Record<string, number> | null;
  overpaymentDisposition?: OverpaymentDisposition | null;
}

export interface CreateInvoicePayload {
  clientId: number;
  date: string;
  notes?: string | null;
  advancePayment: number;
  paid: number;
  paymentMethod: PaymentMethod;
  paymentCurrency: PaymentCurrency;
  exchangeRateSnapshot: number;
  /** Split Mixto / puro: parte en USD. */
  dueUsd?: number | null;
  /** Split Mixto / puro: parte en CUP. */
  dueCup?: number | null;
  transferConcept?: string | null;
  advancePaymentDetail?: AdvancePaymentPayload | null;
  /** Aplicar saldo a favor del cliente al crear (default true). */
  applyClientCredit?: boolean | null;
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
