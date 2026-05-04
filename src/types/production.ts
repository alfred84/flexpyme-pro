export interface ProductionBatchListDto {
  id: number;
  type: string;
  date: string;
  workerName: string | null;
  totalCost: number;
  paid: number;
  pending: number;
}

export interface CreateProductionItemPayload {
  clientId: number;
  formatId: number | null;
  category: string;
  quantity: number;
  unitCost: number;
}

export interface CreateProductionBatchPayload {
  type: string;
  date: string;
  workerName?: string | null;
  paid: number;
  notes?: string | null;
  items: CreateProductionItemPayload[];
}

export interface CreateProductionBatchResponse {
  id: number;
}
