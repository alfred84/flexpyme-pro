/**
 * Estado financiero de una factura para badges y filtros.
 */
export type InvoiceFinancialStatus = "cobrada" | "parcial" | "pendiente" | "anulada";

/**
 * Deriva el estado financiero visible a partir de saldos y anulación.
 *
 * @param balance - Saldo pendiente en CUP.
 * @param paid - Monto pagado acumulado.
 * @param cancelled - Si la factura fue anulada.
 * @returns Estado para UI de facturas.
 */
export function invoiceFinancialStatus(
  balance: number,
  paid: number,
  cancelled: boolean,
): InvoiceFinancialStatus {
  if (cancelled) {
    return "anulada";
  }
  if (balance <= 1e-6) {
    return "cobrada";
  }
  if (paid > 1e-6) {
    return "parcial";
  }
  return "pendiente";
}

/**
 * Clase DaisyUI del badge según estado financiero.
 *
 * @param status - Estado financiero de la factura.
 * @returns Clases CSS del badge.
 */
export function invoiceFinancialBadgeClass(status: InvoiceFinancialStatus): string {
  if (status === "cobrada") {
    return "badge-success";
  }
  if (status === "parcial") {
    return "badge-info";
  }
  if (status === "anulada") {
    return "badge-error";
  }
  return "badge-warning";
}

/**
 * Etiqueta en español del estado financiero.
 *
 * @param status - Estado financiero de la factura.
 * @returns Texto para mostrar al usuario.
 */
export function invoiceFinancialLabel(status: InvoiceFinancialStatus): string {
  if (status === "cobrada") {
    return "Cobrada";
  }
  if (status === "parcial") {
    return "Parcial";
  }
  if (status === "anulada") {
    return "Anulada";
  }
  return "Pendiente";
}
