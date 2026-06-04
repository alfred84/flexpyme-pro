/**
 * Denominaciones de billetes/monedas CUP aceptadas en caja (REQUIREMENTS §4).
 */
export const CASH_DENOMINATIONS = [5000, 1000, 500, 200, 100, 50, 20, 10, 5, 1] as const;

export type CashDenomination = (typeof CASH_DENOMINATIONS)[number];

/**
 * Stored cash session row.
 */
export interface CashSessionDto {
  id: number;
  invoiceId: number;
  totalAmount: number;
  amountReceived: number;
  changeGiven: number;
  date: string;
  denominationBreakdown: string | null;
}

export interface CashierRegisterPayload {
  invoiceId: number;
  counts: Record<string, number>;
}

export interface CashierRegisterResponse {
  sessionId: number;
  amountReceived: number;
  changeGiven: number;
  amountApplied: number;
  invoiceNewBalance: number;
  invoiceStatus: string;
}
