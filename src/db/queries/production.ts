import { invoke } from "@tauri-apps/api/core";
import type {
  CreateProductionBatchPayload,
  CreateProductionBatchResponse,
  ProductionBatchDetailDto,
  ProductionBatchListDto,
} from "@/types/production";

export async function fetchProductionBatches(): Promise<ProductionBatchListDto[]> {
  return invoke<ProductionBatchListDto[]>("production_list");
}

export async function fetchProductionBatchDetail(batchId: number): Promise<ProductionBatchDetailDto> {
  return invoke<ProductionBatchDetailDto>("production_get_detail", { batch_id: batchId });
}

export async function createProductionBatch(
  payload: CreateProductionBatchPayload,
): Promise<CreateProductionBatchResponse> {
  return invoke<CreateProductionBatchResponse>("production_create", { payload });
}
