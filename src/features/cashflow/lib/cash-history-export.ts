import { cashTransactionReferenceLabel } from "@/components/cashflow/CashTransactionReference";
import { hasCashAmount } from "@/features/cashflow/lib/cash-amount-display";
import { formatDate, formatDateTime } from "@/lib/format-date";
import type { ReportTableSection } from "@/lib/report-export";
import type { CashTransactionDto } from "@/types/cashflow";

/**
 * Totales duales del historial filtrado.
 */
export interface CashHistoryExportTotals {
  incomeCup: number;
  expenseCup: number;
  netCup: number;
  incomeUsd: number;
  expenseUsd: number;
  netUsd: number;
}

/**
 * Filtros activos del historial, para metadatos del exporte.
 */
export interface CashHistoryExportFilters {
  dateFrom: string;
  dateTo: string;
  type: string;
  currency: string;
  paymentMethod: string;
  concept: string;
}

/**
 * Etiqueta del periodo para cabeceras y nombres de archivo.
 *
 * @param dateFrom - ISO `YYYY-MM-DD` o vacío.
 * @param dateTo - ISO `YYYY-MM-DD` o vacío.
 * @returns Texto en español con fechas `dd/mm/aaaa` cuando aplica.
 */
export function cashHistoryPeriodLabel(dateFrom: string, dateTo: string): string {
  if (dateFrom && dateTo) {
    return `${formatDate(dateFrom)} – ${formatDate(dateTo)}`;
  }
  if (dateFrom) {
    return `Desde ${formatDate(dateFrom)}`;
  }
  if (dateTo) {
    return `Hasta ${formatDate(dateTo)}`;
  }
  return "Todos";
}

/**
 * Etiqueta del filtro de tipo de movimiento.
 *
 * @param type - `ingreso`, `egreso` o vacío.
 * @returns Texto para metadatos.
 */
function typeFilterLabel(type: string): string {
  if (type === "ingreso") {
    return "Ingresos";
  }
  if (type === "egreso") {
    return "Egresos";
  }
  return "Todos";
}

/**
 * Etiqueta del filtro de moneda física.
 *
 * @param currency - `cup`, `usd`, `mixto` o vacío.
 * @returns Texto para metadatos.
 */
function currencyFilterLabel(currency: string): string {
  if (currency === "cup") {
    return "Solo CUP";
  }
  if (currency === "usd") {
    return "Solo USD";
  }
  if (currency === "mixto") {
    return "Mixto";
  }
  return "Todas";
}

/**
 * Etiqueta del filtro de método de pago.
 *
 * @param paymentMethod - `efectivo`, `transferencia` o vacío.
 * @returns Texto para metadatos.
 */
function methodFilterLabel(paymentMethod: string): string {
  if (paymentMethod === "efectivo") {
    return "Efectivo";
  }
  if (paymentMethod === "transferencia") {
    return "Transferencia";
  }
  return "Todos";
}

/**
 * Importe con signo para Excel/PDF (ingreso positivo, egreso negativo).
 *
 * @param amount - Valor absoluto almacenado.
 * @param isIncome - `true` si es ingreso.
 * @returns Importe firmado.
 */
function signedCashAmount(amount: number, isIncome: boolean): number {
  const signed = isIncome ? amount : -amount;
  return hasCashAmount(signed) ? signed : 0;
}

/**
 * Secciones Excel/PDF del historial filtrado (CUP y USD físicos).
 *
 * @param rows - Transacciones visibles.
 * @param filters - Filtros de la pantalla.
 * @param totals - Totales del listado.
 * @returns Tablas para el exporte.
 */
export function buildCashHistoryExportSections(
  rows: CashTransactionDto[],
  filters: CashHistoryExportFilters,
  totals: CashHistoryExportTotals,
): ReportTableSection[] {
  const periodLabel = cashHistoryPeriodLabel(filters.dateFrom, filters.dateTo);
  const conceptLabel = filters.concept.trim() ? filters.concept.trim() : "(vacío)";

  return [
    {
      name: "METADATOS",
      aoa: [
        ["Campo", "Valor"],
        ["Periodo", periodLabel],
        ["Tipo", typeFilterLabel(filters.type)],
        ["Moneda", currencyFilterLabel(filters.currency)],
        ["Método", methodFilterLabel(filters.paymentMethod)],
        ["Concepto", conceptLabel],
        ["Registros", rows.length],
        ["Ingresos USD", totals.incomeUsd],
        ["Ingresos CUP", totals.incomeCup],
        ["Egresos USD", totals.expenseUsd],
        ["Egresos CUP", totals.expenseCup],
        ["Neto USD", totals.netUsd],
        ["Neto CUP", totals.netCup],
      ],
    },
    {
      name: "HISTORIAL_CAJA",
      aoa: [
        ["Fecha", "Tipo", "Concepto", "Referencia", "Método", "USD", "CUP", "Tasa"],
        ...rows.map((tx) => {
          const isIncome = tx.transactionType === "ingreso";
          const reference = cashTransactionReferenceLabel(tx.referenceType, tx.referenceId);
          const rate =
            hasCashAmount(tx.amountUsd) && hasCashAmount(tx.exchangeRate) ? tx.exchangeRate : "";
          return [
            formatDateTime(tx.date),
            isIncome ? "Ingreso" : "Egreso",
            tx.concept,
            reference || "—",
            tx.paymentMethod
              ? tx.paymentMethod.charAt(0).toUpperCase() + tx.paymentMethod.slice(1)
              : "",
            signedCashAmount(tx.amountUsd, isIncome),
            signedCashAmount(tx.amountCup, isIncome),
            rate,
          ];
        }),
        [
          "TOTAL",
          "",
          "",
          "",
          "",
          totals.netUsd,
          totals.netCup,
          "",
        ],
      ],
    },
  ];
}
