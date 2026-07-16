/**
 * Denominaciones de billetes/monedas CUP aceptadas en caja (REQUIREMENTS §4).
 */
export const CASH_DENOMINATIONS = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 1] as const;

export type CashDenomination = (typeof CASH_DENOMINATIONS)[number];

/**
 * Denominaciones de billetes USD aceptadas en caja.
 */
export const USD_DENOMINATIONS = [100, 50, 20, 10, 5, 2, 1] as const;

export type UsdDenomination = (typeof USD_DENOMINATIONS)[number];

/**
 * Moneda de una cuadrícula de denominaciones.
 */
export type DenominationCurrency = "CUP" | "USD";

/**
 * Devuelve el set de denominaciones para una moneda dada.
 *
 * @param currency - Moneda (`CUP` o `USD`).
 * @returns Lista de denominaciones de mayor a menor.
 */
export function denominationsFor(currency: DenominationCurrency): readonly number[] {
  return currency === "USD" ? USD_DENOMINATIONS : CASH_DENOMINATIONS;
}

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
  /** Conteo de billetes CUP (efectivo con desglose). */
  counts?: Record<string, number> | null;
  /** Monto directo en CUP (transferencia o efectivo sin desglose). */
  amountCup?: number | null;
  /** Monto en USD si el pedido se cobra en dólares. */
  amountUsd?: number | null;
  exchangeRate?: number | null;
  transferConcept?: string | null;
}

export interface CashierRegisterResponse {
  sessionId: number | null;
  amountReceived: number;
  changeGiven: number;
  amountApplied: number;
  invoiceNewBalance: number;
  invoiceStatus: string;
  paymentStatus: string;
}
