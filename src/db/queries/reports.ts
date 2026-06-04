import { invoke } from "@tauri-apps/api/core";
import type {
  CategoryIncomeDto,
  ReportsRangeArgs,
  ReportsSummaryDto,
  TopDebtorDto,
} from "@/types/report";

export async function fetchReportsSummary(args: ReportsRangeArgs): Promise<ReportsSummaryDto> {
  return invoke<ReportsSummaryDto>("reports_summary", { args });
}

export async function fetchTopDebtors(limit = 10): Promise<TopDebtorDto[]> {
  return invoke<TopDebtorDto[]>("reports_top_debtors", { limit });
}

/**
 * Loads total billed per product category within a date range (dashboard chart).
 */
export async function fetchIncomeByCategory(args: ReportsRangeArgs): Promise<CategoryIncomeDto[]> {
  return invoke<CategoryIncomeDto[]>("reports_income_by_category", { args });
}
