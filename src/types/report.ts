export interface ReportsRangeArgs {
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface ReportsSummaryDto {
  invoicesCount: number;
  totalBilled: number;
  totalPaid: number;
  totalPending: number;
  productionTotalCost: number;
  productionPaid: number;
  productionPending: number;
}

export interface TopDebtorDto {
  clientId: number;
  clientCode: string;
  clientName: string;
  balance: number;
}
