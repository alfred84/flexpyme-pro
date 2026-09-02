import { formatDate, monthEndIso, monthStartIso, todayIso } from "@/lib/format-date";
import type { ReportTableSection } from "@/lib/report-export";
import {
  WORK_TYPE_LABELS,
  type PayrollHistoryRowDto,
  type WorkType,
} from "@/types/employee";

/** Periodo rápido del historial de nómina. */
export type PayrollHistoryPeriod = "hoy" | "mes" | "rango" | "todos";

/** Filtro de estado de pago. */
export type PayrollHistoryStatusFilter = "" | "pagado" | "pendiente";

/** Filtro de concepto (lote vs tipos de salario). */
export type PayrollHistoryConceptFilter =
  | ""
  | "lote"
  | "salario_fijo"
  | "salario_destajo"
  | "salario_mensual";

/**
 * Totales del listado filtrado.
 */
export interface PayrollHistoryTotals {
  totalCost: number;
  paid: number;
  pending: number;
  workers: number;
}

/**
 * Nómina agregada por trabajador.
 */
export interface PayrollWorkerSummary {
  employeeId: number;
  employeeName: string;
  movimientos: number;
  totalCost: number;
  paid: number;
  pending: number;
}

/**
 * Rango ISO resuelto a partir de los controles de periodo.
 *
 * @param period - Periodo activo.
 * @param month - Mes `YYYY-MM` (modo mes).
 * @param rangeFrom - Desde (modo rango).
 * @param rangeTo - Hasta (modo rango).
 * @returns Fechas o `null` si es histórico completo.
 */
export function resolvePayrollHistoryRange(
  period: PayrollHistoryPeriod,
  month: string,
  rangeFrom: string,
  rangeTo: string,
): { dateFrom: string | null; dateTo: string | null } {
  switch (period) {
    case "hoy": {
      const today = todayIso();
      return { dateFrom: today, dateTo: today };
    }
    case "mes": {
      const start = `${month}-01`;
      return { dateFrom: monthStartIso(start), dateTo: monthEndIso(start) };
    }
    case "rango":
      return { dateFrom: rangeFrom || null, dateTo: rangeTo || null };
    default:
      return { dateFrom: null, dateTo: null };
  }
}

/**
 * Etiqueta del periodo para cabeceras y nombres de archivo.
 *
 * @param period - Periodo activo.
 * @param month - Mes `YYYY-MM`.
 * @param rangeFrom - Desde ISO.
 * @param rangeTo - Hasta ISO.
 * @returns Texto en español con fechas `dd/mm/aaaa` cuando aplica.
 */
export function payrollHistoryPeriodLabel(
  period: PayrollHistoryPeriod,
  month: string,
  rangeFrom: string,
  rangeTo: string,
): string {
  const { dateFrom, dateTo } = resolvePayrollHistoryRange(period, month, rangeFrom, rangeTo);
  switch (period) {
    case "hoy":
      return `Día ${formatDate(dateFrom)}`;
    case "mes": {
      const parts = month.split("-");
      return parts.length === 2 ? `Mes ${parts[1]}/${parts[0]}` : "Mes actual";
    }
    case "rango": {
      if (dateFrom && dateTo) {
        return `${formatDate(dateFrom)} – ${formatDate(dateTo)}`;
      }
      if (dateFrom) {
        return `Desde ${formatDate(dateFrom)}`;
      }
      if (dateTo) {
        return `Hasta ${formatDate(dateTo)}`;
      }
      return "Rango";
    }
    default:
      return "Todos";
  }
}

/**
 * Etiqueta de concepto de una fila de historial.
 *
 * @param row - Fila de nómina.
 * @returns Texto en español.
 */
export function payrollHistoryConceptLabel(row: PayrollHistoryRowDto): string {
  switch (row.conceptKey) {
    case "salario_fijo":
      return "Salario fijo diario";
    case "salario_destajo":
      return "Destajo";
    case "salario_mensual":
      return "Salario mensual";
    default:
      return WORK_TYPE_LABELS[row.conceptKey as WorkType] ?? row.conceptKey;
  }
}

/**
 * Indica si la fila pasa el filtro de concepto.
 *
 * @param row - Fila.
 * @param concept - Filtro activo.
 * @returns `true` si debe mostrarse.
 */
export function payrollHistoryMatchesConcept(
  row: PayrollHistoryRowDto,
  concept: PayrollHistoryConceptFilter,
): boolean {
  if (!concept) {
    return true;
  }
  if (concept === "lote") {
    return row.source === "lote";
  }
  return row.conceptKey === concept;
}

/**
 * Filtra filas por estado y concepto (el periodo y el trabajador van al backend).
 *
 * @param rows - Historial del servidor.
 * @param status - Estado de pago.
 * @param concept - Concepto.
 * @returns Filas visibles.
 */
export function filterPayrollHistoryRows(
  rows: PayrollHistoryRowDto[],
  status: PayrollHistoryStatusFilter,
  concept: PayrollHistoryConceptFilter,
): PayrollHistoryRowDto[] {
  return rows.filter((row) => {
    if (status && row.status !== status) {
      return false;
    }
    return payrollHistoryMatchesConcept(row, concept);
  });
}

/**
 * Agrega el historial por trabajador.
 *
 * @param rows - Filas visibles.
 * @returns Resumen ordenado por nombre.
 */
export function summarizePayrollByWorker(rows: PayrollHistoryRowDto[]): PayrollWorkerSummary[] {
  const map = new Map<number, PayrollWorkerSummary>();
  for (const row of rows) {
    let summary = map.get(row.employeeId);
    if (!summary) {
      summary = {
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        movimientos: 0,
        totalCost: 0,
        paid: 0,
        pending: 0,
      };
      map.set(row.employeeId, summary);
    }
    summary.movimientos += 1;
    summary.totalCost += row.totalCost;
    summary.paid += row.paid;
    summary.pending += row.pending;
  }
  return [...map.values()].sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName, "es", { sensitivity: "base" }),
  );
}

/**
 * Totales del listado visible.
 *
 * @param rows - Filas visibles.
 * @param workers - Resumen por trabajador.
 * @returns KPIs.
 */
export function payrollHistoryTotals(
  rows: PayrollHistoryRowDto[],
  workers: PayrollWorkerSummary[],
): PayrollHistoryTotals {
  let totalCost = 0;
  let paid = 0;
  let pending = 0;
  for (const row of rows) {
    totalCost += row.totalCost;
    paid += row.paid;
    pending += row.pending;
  }
  return { totalCost, paid, pending, workers: workers.length };
}

/**
 * Secciones Excel/PDF del historial filtrado (importes en CUP).
 *
 * @param rows - Detalle visible.
 * @param workers - Resumen por trabajador.
 * @param periodLabel - Periodo.
 * @param employeeLabel - Trabajador o «Todos».
 * @param statusLabel - Estado o «Todos».
 * @param conceptLabel - Concepto o «Todos».
 * @param totals - KPIs.
 * @returns Tablas para el exporte.
 */
export function buildPayrollHistoryExportSections(params: {
  rows: PayrollHistoryRowDto[];
  workers: PayrollWorkerSummary[];
  periodLabel: string;
  employeeLabel: string;
  statusLabel: string;
  conceptLabel: string;
  totals: PayrollHistoryTotals;
}): ReportTableSection[] {
  const { rows, workers, periodLabel, employeeLabel, statusLabel, conceptLabel, totals } = params;
  return [
    {
      name: "METADATOS",
      aoa: [
        ["Campo", "Valor"],
        ["Periodo", periodLabel],
        ["Trabajador", employeeLabel],
        ["Estado", statusLabel],
        ["Concepto", conceptLabel],
        ["Movimientos", rows.length],
        ["Trabajadores", totals.workers],
        ["Total CUP", totals.totalCost],
        ["Pagado CUP", totals.paid],
        ["Pendiente CUP", totals.pending],
      ],
    },
    {
      name: "NOMINA_TRABAJADORES",
      aoa: [
        ["Trabajador", "Movimientos", "Total CUP", "Pagado CUP", "Pendiente CUP"],
        ...workers.map((w) => [w.employeeName, w.movimientos, w.totalCost, w.paid, w.pending]),
        ["TOTAL", rows.length, totals.totalCost, totals.paid, totals.pending],
      ],
    },
    {
      name: "NOMINA_HISTORIAL",
      aoa: [
        ["Fecha", "Trabajador", "Concepto", "Origen", "Total CUP", "Pagado CUP", "Pendiente CUP", "Estado"],
        ...rows.map((row) => [
          formatDate(row.date),
          row.employeeName,
          payrollHistoryConceptLabel(row),
          row.source === "lote" ? "Lote" : "Salario",
          row.totalCost,
          row.paid,
          row.pending,
          row.status === "pagado" ? "Pagado" : "Pendiente",
        ]),
        ["TOTAL", "", "", "", totals.totalCost, totals.paid, totals.pending, ""],
      ],
    },
  ];
}
