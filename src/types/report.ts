export interface ReportsRangeArgs {
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface ReportsSummaryDto {
  invoicesCount: number;
  totalBilled: number;
  totalPaid: number;
  totalPending: number;
  /** Facturas con estado paid en el rango (o global si no hay rango). */
  invoicesPaidCount: number;
  invoicesPartialCount: number;
  invoicesPendingCount: number;
  /** Promedio total / cantidad de facturas en el alcance del resumen. */
  averageInvoiceAmount: number;
  /** Cobrado / facturado en el alcance (0–1). */
  collectionRate: number;
  /** Clientes con balance > 0 (activos). */
  clientsWithReceivablesCount: number;
  productionTotalCost: number;
  productionPaid: number;
  productionPending: number;
  /** Lotes de producción en el mismo rango de fechas que el resumen de producción. */
  productionBatchesCount: number;
}

export interface TopDebtorDto {
  clientId: number;
  clientCode: string;
  clientName: string;
  balance: number;
}

/**
 * Total facturado por categoría (gráfico del dashboard).
 */
export interface CategoryIncomeDto {
  category: string;
  label: string;
  total: number;
}
