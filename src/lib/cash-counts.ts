import { CASH_DENOMINATIONS, denominationsFor, type DenominationCurrency } from "@/types/cashier";

/**
 * Mapa vacío de conteo por denominación para la moneda indicada.
 *
 * @param currency - Moneda del conteo (por defecto CUP).
 * @returns Objeto con cada denominación en cero.
 */
export function emptyDenominationCounts(currency: DenominationCurrency = "CUP"): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const d of denominationsFor(currency)) {
    counts[String(d)] = 0;
  }
  return counts;
}

/**
 * Suma el valor de un conteo de billetes para la moneda indicada.
 *
 * @param counts - Conteo por denominación.
 * @param currency - Moneda del conteo (por defecto CUP).
 * @returns Importe total en la moneda del conteo.
 */
export function sumDenominationCounts(
  counts: Record<string, number>,
  currency: DenominationCurrency = "CUP",
): number {
  let total = 0;
  for (const d of denominationsFor(currency)) {
    total += d * (counts[String(d)] ?? 0);
  }
  return total;
}

/**
 * Construye payload de conteo omitiendo el resultado si todo está en cero.
 *
 * @param counts - Conteo por denominación.
 * @param currency - Moneda del conteo (por defecto CUP).
 * @returns Objeto de conteo o `null` si no hay ninguna denominación.
 */
export function buildCountsPayload(
  counts: Record<string, number>,
  currency: DenominationCurrency = "CUP",
): Record<string, number> | null {
  const payload: Record<string, number> = {};
  let hasAny = false;
  for (const d of denominationsFor(currency)) {
    const key = String(d);
    const value = counts[key] ?? 0;
    payload[key] = value;
    if (value > 0) {
      hasAny = true;
    }
  }
  return hasAny ? payload : null;
}

/**
 * Serializa un desglose de denominaciones a JSON con marca de moneda.
 *
 * @param counts - Conteo por denominación.
 * @param currency - Moneda del conteo.
 * @returns Cadena JSON con `{ currency, counts }` o `null` si está vacío.
 */
export function serializeDenominationBreakdown(
  counts: Record<string, number>,
  currency: DenominationCurrency = "CUP",
): string | null {
  const payload = buildCountsPayload(counts, currency);
  if (!payload) {
    return null;
  }
  return JSON.stringify({ currency, counts: payload });
}

/**
 * Serializa el desglose de una venta de material (una moneda o mixto).
 *
 * @param paymentCurrency - Moneda de cobro (`CUP`, `USD` o `mixto`).
 * @param cupCounts - Conteo CUP (usado en CUP y mixto).
 * @param usdCounts - Conteo USD (usado en USD y mixto).
 * @returns JSON de auditoría o `null` si no hay billetes.
 */
export function serializeSaleDenominationBreakdown(
  paymentCurrency: "CUP" | "USD" | "mixto",
  cupCounts: Record<string, number>,
  usdCounts: Record<string, number>,
): string | null {
  if (paymentCurrency === "mixto") {
    const cup = buildCountsPayload(cupCounts, "CUP");
    const usd = buildCountsPayload(usdCounts, "USD");
    if (!cup && !usd) {
      return null;
    }
    return JSON.stringify({ mixto: true, cup, usd });
  }
  if (paymentCurrency === "USD") {
    return serializeDenominationBreakdown(usdCounts, "USD");
  }
  return serializeDenominationBreakdown(cupCounts, "CUP");
}

/**
 * Resultado de parsear un desglose de denominaciones almacenado.
 */
export interface ParsedDenominationBreakdown {
  currency: DenominationCurrency;
  counts: Record<string, number>;
}

/**
 * Parsea el JSON de desglose guardado en caja/gastos.
 *
 * @param raw - Cadena JSON o `null`.
 * @returns Moneda y conteos, o `null` si no es válido.
 */
export function parseDenominationBreakdown(
  raw: string | null | undefined,
): ParsedDenominationBreakdown | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as {
      currency?: string;
      counts?: Record<string, number>;
    };
    const currency: DenominationCurrency = parsed.currency === "USD" ? "USD" : "CUP";
    const counts = emptyDenominationCounts(currency);
    if (parsed.counts && typeof parsed.counts === "object") {
      for (const d of denominationsFor(currency)) {
        const key = String(d);
        const value = Number(parsed.counts[key] ?? 0);
        counts[key] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
      }
    }
    return { currency, counts };
  } catch {
    return null;
  }
}

// Reexport para retrocompatibilidad de importaciones existentes.
export { CASH_DENOMINATIONS };
