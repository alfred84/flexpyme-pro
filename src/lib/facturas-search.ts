import type { InvoiceFinancialStatus } from "@/lib/invoice-financial-status";

/** Filtros de estado financiero en el listado de Facturas (sin «todas»). */
export const FACTURA_ESTADOS = ["pendiente", "parcial", "cobrada", "anulada"] as const;

/** Estado de búsqueda en `/facturas`. */
export type FacturaSearchEstado = (typeof FACTURA_ESTADOS)[number];

/**
 * Parámetros de búsqueda por defecto para Facturas (listado completo).
 */
export const facturasListSearch = { estado: undefined as FacturaSearchEstado | undefined };

/**
 * Interpreta el parámetro `estado` de la ruta Facturas.
 *
 * @param raw - Valor crudo de la URL.
 * @returns Estado válido o `undefined` (Todas).
 */
export function parseFacturaEstado(raw: unknown): FacturaSearchEstado | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  return (FACTURA_ESTADOS as readonly string[]).includes(raw)
    ? (raw as FacturaSearchEstado)
    : undefined;
}

/**
 * Convierte el filtro de UI al parámetro de búsqueda.
 *
 * @param filter - Filtro de la pantalla (incluye «todas»).
 * @returns `estado` para la URL, o `undefined` si es Todas.
 */
export function facturaFilterToSearch(
  filter: "todas" | InvoiceFinancialStatus,
): FacturaSearchEstado | undefined {
  return filter === "todas" ? undefined : filter;
}
