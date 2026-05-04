import { invoke } from "@tauri-apps/api/core";
import type {
  CreateProductionBatchPayload,
  CreateProductionBatchResponse,
  ProductionBatchDetailDto,
  ProductionBatchListDto,
  ProductionRangeExportDto,
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
