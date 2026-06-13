import { invoke } from "@tauri-apps/api/core";
import type { StockItemDto, StockMetricsDto } from "@/types/stock";

/**
 * Pedidos listos para entrega.
 */
export async function fetchStockItems(paymentStatusFilter?: string | null): Promise<StockItemDto[]> {
  return invoke<StockItemDto[]>("get_stock_items", { paymentStatusFilter: paymentStatusFilter ?? null });
}

/**
 * Métricas KPI del módulo Stock.
 */
export async function fetchStockMetrics(): Promise<StockMetricsDto> {
  return invoke<StockMetricsDto>("get_stock_metrics");
}
