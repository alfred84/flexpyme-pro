import { invoke } from "@tauri-apps/api/core";
import type {
  CreateProductionBatchPayload,
  CreateProductionBatchResponse,
  ProductionBatchDetailDto,
  ProductionBatchListDto,
  ProductionRangeExportDto,
  ProductionReportDto,
} from "@/types/production";

export async function fetchProductionBatches(): Promise<ProductionBatchListDto[]> {
  return invoke<ProductionBatchListDto[]>("production_list");
}

export async function fetchProductionBatchDetail(batchId: number): Promise<ProductionBatchDetailDto> {
  return invoke<ProductionBatchDetailDto>("production_get_detail", { batchId });
}

export async function fetchProductionExportInDateRange(
  dateFrom: string,
  dateTo: string,
): Promise<ProductionRangeExportDto> {
  return invoke<ProductionRangeExportDto>("production_export_in_date_range", {
    dateFrom,
    dateTo,
  });
}

export async function createProductionBatch(
  payload: CreateProductionBatchPayload,
): Promise<CreateProductionBatchResponse> {
  return invoke<CreateProductionBatchResponse>("production_create", { payload });
}

/**
 * Carga el reporte mensual de producción por área/formato (`YYYY-MM`).
 */
export async function fetchProductionReportMonthly(month: string): Promise<ProductionReportDto> {
  return invoke<ProductionReportDto>("production_report_monthly", { month });
}
