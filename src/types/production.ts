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

export interface ProductionBatchHeaderDto {
  id: number;
  type: string;
  date: string;
  workerName: string | null;
  totalCost: number;
  paid: number;
  pending: number;
  notes: string | null;
}

export interface ProductionBatchLineDto {
  id: number;
  clientId: number;
  clientCode: string;
  clientName: string;
  formatId: number | null;
  formatLabel: string | null;
  category: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
}

export interface ProductionBatchDetailDto {
  batch: ProductionBatchHeaderDto;
  items: ProductionBatchLineDto[];
}

/** Lote dentro del rango (exporte reportes / CSV). */
export interface ProductionBatchInRangeDto {
  id: number;
  type: string;
  date: string;
  workerName: string | null;
  totalCost: number;
  paid: number;
  pending: number;
  notes: string | null;
}

/** Línea de producción con contexto del lote (mismo rango). */
export interface ProductionLineInRangeDto {
  batchId: number;
  batchDate: string;
  batchType: string;
  workerName: string | null;
  lineId: number;
  clientCode: string;
  clientName: string;
  formatLabel: string | null;
  category: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
}

export interface ProductionRangeExportDto {
  batches: ProductionBatchInRangeDto[];
  lines: ProductionLineInRangeDto[];
}
