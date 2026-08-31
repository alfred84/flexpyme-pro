import { invoke } from "@tauri-apps/api/core";
import type {
  CategoryIncomeDto,
  ReportsRangeArgs,
  ReportsSummaryDto,
  TopDebtorDto,
} from "@/types/report";

/**
 * Carga el resumen de reportes (KPIs de facturación, cobro y producción) para un rango.
 *
 * @param args - Fechas inclusivas `YYYY-MM-DD`, o vacías para todo el histórico.
 * @returns Resumen con importes de libro y montos físicos CUP/USD.
 */
export async function fetchReportsSummary(args: ReportsRangeArgs): Promise<ReportsSummaryDto> {
  return invoke<ReportsSummaryDto>("reports_summary", { args });
}

/**
 * Lista los clientes con mayor saldo pendiente.
 *
 * @param limit - Máximo de filas (1–100 en backend).
 * @returns Deudores ordenados por balance.
 */
export async function fetchTopDebtors(limit = 10): Promise<TopDebtorDto[]> {
  return invoke<TopDebtorDto[]>("reports_top_debtors", { limit });
}

/**
 * Carga el facturado físico por categoría de producto en un rango de fechas.
 *
 * @param args - Fechas inclusivas `YYYY-MM-DD`.
 * @returns Totales CUP y USD por categoría (sin conversión por tasa de app).
 */
export async function fetchIncomeByCategory(args: ReportsRangeArgs): Promise<CategoryIncomeDto[]> {
  return invoke<CategoryIncomeDto[]>("reports_income_by_category", { args });
}
