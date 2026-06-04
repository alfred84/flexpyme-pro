/**
 * Bill/coin denominations accepted at register (unidades monetarias locales).
 */
export const CASH_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5] as const;

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
