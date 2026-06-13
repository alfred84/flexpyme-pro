/**
 * Pedido listo para entrega en el módulo Stock.
 */
export interface StockItemDto {
  id: number;
  invoiceNumber: string;
  clientId: number;
  clientName: string;
  date: string;
  total: number;
  balance: number;
  paymentStatus: string;
  productionCompletedAt: string | null;
  daysWaiting: number;
  productsSummary: string;
}

/**
 * KPIs del módulo Stock.
 */
export interface StockMetricsDto {
  totalListo: number;
  cobrado: number;
  sinCobrar: number;
  avgDaysWaiting: number;
  staleCount: number;
}
