import {
  currentMonthYm,
  formatDate,
  monthEndIso,
  todayIso,
} from "@/lib/format-date";

/** Modo de periodo del hub de reportes. */
export type ReportPeriodKind = "dia" | "mes" | "total" | "rango";

/** Grupo visible en el hub. */
export type ReportGroupId = "produccion" | "contabilidad";

/** Informe de producción. */
export type ProductionReportId = "area" | "diario" | "consumo" | "movimientos";

/** Informe de nómina y contabilidad. */
export type AccountingReportId = "nomina" | "facturacion" | "caja" | "gastos" | "deudores";

/** Informe activo (unión de ambos grupos). */
export type OperationalReportId = ProductionReportId | AccountingReportId;

/** Estado de los controles de periodo. */
export interface ReportPeriodState {
  kind: ReportPeriodKind;
  /** Día ISO (`YYYY-MM-DD`) para modo Día. */
  day: string;
  /** Mes `YYYY-MM` para modo Mes. */
  month: string;
  /** Inicio de rango ISO. */
  rangeFrom: string;
  /** Fin de rango ISO. */
  rangeTo: string;
}

/** Rango resuelto para queries Tauri. */
export interface ResolvedReportRange {
  dateFrom: string | null;
  dateTo: string | null;
  /** `false` si el rango custom está incompleto o invertido. */
  ready: boolean;
}

/**
 * Estado inicial: mes en curso (el informe histórico era mensual).
 *
 * @returns Controles de periodo con hoy y mes actual.
 */
export function defaultReportPeriod(): ReportPeriodState {
  const today = todayIso();
  return {
    kind: "mes",
    day: today,
    month: currentMonthYm(),
    rangeFrom: "",
    rangeTo: "",
  };
}

/**
 * Convierte el estado de la barra de periodo en `dateFrom`/`dateTo` para el backend.
 *
 * @param state - Controles de periodo.
 * @returns Rango ISO o `null` en Total; `ready` indica si se puede consultar.
 */
export function resolveReportRange(state: ReportPeriodState): ResolvedReportRange {
  switch (state.kind) {
    case "dia": {
      const day = state.day.trim();
      const ok = /^\d{4}-\d{2}-\d{2}$/.test(day);
      return { dateFrom: ok ? day : null, dateTo: ok ? day : null, ready: ok };
    }
    case "mes": {
      const month = state.month.trim();
      const ok = /^\d{4}-\d{2}$/.test(month);
      if (!ok) {
        return { dateFrom: null, dateTo: null, ready: false };
      }
      const start = `${month}-01`;
      return { dateFrom: start, dateTo: monthEndIso(start), ready: true };
    }
    case "total":
      return { dateFrom: null, dateTo: null, ready: true };
    case "rango": {
      const from = state.rangeFrom.trim();
      const to = state.rangeTo.trim();
      const ok =
        /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
      return { dateFrom: from || null, dateTo: to || null, ready: ok };
    }
    default:
      return { dateFrom: null, dateTo: null, ready: false };
  }
}

/**
 * Etiqueta legible del periodo para cabeceras y archivos exportados.
 *
 * @param state - Controles de periodo.
 * @returns Texto en español con fechas `dd/mm/aaaa` cuando aplica.
 */
export function reportPeriodLabel(state: ReportPeriodState): string {
  const range = resolveReportRange(state);
  switch (state.kind) {
    case "dia":
      return range.ready ? `Día ${formatDate(state.day)}` : "Día";
    case "mes": {
      const parts = state.month.split("-");
      if (parts.length === 2) {
        return `Mes ${parts[1]}/${parts[0]}`;
      }
      return "Mes";
    }
    case "total":
      return "Total";
    case "rango":
      if (!range.ready) {
        return "Rango incompleto";
      }
      return `Rango ${formatDate(range.dateFrom)} – ${formatDate(range.dateTo)}`;
    default:
      return "";
  }
}

/**
 * Nombre de archivo seguro (sin espacios raros) a partir de la etiqueta.
 *
 * @param reportName - Nombre del informe.
 * @param periodLabel - Etiqueta de periodo.
 * @returns Base de archivo, p. ej. `reportes-nomina-mes-08-2026`.
 */
export function reportExportBasename(reportName: string, periodLabel: string): string {
  const slug = `${reportName}-${periodLabel}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `reportes-${slug || "export"}`;
}

/** Informes del grupo Producción. */
export const PRODUCTION_REPORTS: { id: ProductionReportId; label: string }[] = [
  { id: "area", label: "Por área y formato" },
  { id: "diario", label: "Control diario" },
  { id: "consumo", label: "Consumo de materiales" },
  { id: "movimientos", label: "Movimientos de inventario" },
];

/** Informes del grupo Nómina y Contabilidad. */
export const ACCOUNTING_REPORTS: { id: AccountingReportId; label: string }[] = [
  { id: "nomina", label: "Nómina" },
  { id: "facturacion", label: "Facturación y cobros" },
  { id: "caja", label: "Flujo de caja" },
  { id: "gastos", label: "Otros gastos" },
  { id: "deudores", label: "Cuentas por cobrar" },
];

/**
 * Título de un informe operativo.
 *
 * @param id - Identificador del informe.
 * @returns Nombre para UI y exportes.
 */
export function operationalReportTitle(id: OperationalReportId): string {
  const all = [...PRODUCTION_REPORTS, ...ACCOUNTING_REPORTS];
  return all.find((item) => item.id === id)?.label ?? "Reporte";
}
