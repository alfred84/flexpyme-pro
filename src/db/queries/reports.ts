import { invoke } from "@tauri-apps/api/core";
import type { ReportsRangeArgs, ReportsSummaryDto, TopDebtorDto } from "@/types/report";

export async function fetchReportsSummary(args: ReportsRangeArgs): Promise<ReportsSummaryDto> {
  return invoke<ReportsSummaryDto>("reports_summary", { args });
}

export async function fetchTopDebtors(limit = 10): Promise<TopDebtorDto[]> {
  return invoke<TopDebtorDto[]>("reports_top_debtors", { limit });
}
