import { CASH_DENOMINATIONS } from "@/types/cashier";

/**
 * Mapa vacío de conteo por denominación CUP.
 */
export function emptyDenominationCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const d of CASH_DENOMINATIONS) {
    counts[String(d)] = 0;
  }
  return counts;
}

/**
 * Suma el valor en CUP de un conteo de billetes.
 */
export function sumDenominationCounts(counts: Record<string, number>): number {
  let total = 0;
  for (const d of CASH_DENOMINATIONS) {
    total += d * (counts[String(d)] ?? 0);
  }
  return total;
}

/**
 * Construye payload de conteo omitiendo denominaciones en cero.
 */
export function buildCountsPayload(counts: Record<string, number>): Record<string, number> | null {
  const payload: Record<string, number> = {};
  let hasAny = false;
  for (const d of CASH_DENOMINATIONS) {
    const key = String(d);
    const value = counts[key] ?? 0;
    payload[key] = value;
    if (value > 0) {
      hasAny = true;
    }
  }
  return hasAny ? payload : null;
}
