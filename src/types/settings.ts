/**
 * Company profile stored in `settings` (used on printed invoices).
 */
export interface CompanySettingsDto {
  companyName: string;
  companyRnc: string;
  companyPhone: string;
  companyAddress: string;
}

/** Origen de un cambio de tasa USD → CUP. */
export type ExchangeRateSource = "header" | "config";

/** Fila del histórico de tasas de cambio. */
export interface ExchangeRateHistoryDto {
  id: number;
  rate: number;
  effectiveAt: string;
  source: ExchangeRateSource;
  previousRate: number | null;
}
