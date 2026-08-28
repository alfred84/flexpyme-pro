import { emptyDenominationCounts } from "@/lib/cash-counts";
import type { CashControlLineDto } from "@/types/cashflow";
import type { DenominationCurrency } from "@/types/cashier";

/**
 * Construye un mapa de conteo a partir de las cantidades de saldo inicial.
 *
 * @param lines - Filas de control de una moneda.
 * @param currency - Moneda del conteo.
 * @returns Conteo por denominación (ceros incluidos).
 */
export function countsFromOpeningLines(
  lines: CashControlLineDto[],
  currency: DenominationCurrency,
): Record<string, number> {
  const counts = emptyDenominationCounts(currency);
  for (const line of lines) {
    const key = String(line.denomination);
    if (key in counts) {
      const qty = Number(line.openingQty);
      counts[key] = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;
    }
  }
  return counts;
}
