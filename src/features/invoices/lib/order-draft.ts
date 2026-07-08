import type { PriceRowDto } from "@/types/price";

/**
 * Línea de borrador en el formulario de nuevo pedido.
 */
export interface DraftLine {
  key: string;
  categoryId: number;
  formatId: number | null;
  finish: string;
  service: string;
  quantity: string;
  unitPrice: string;
}

/**
 * Crea una línea vacía con categoría por defecto.
 *
 * @param categoryId - Id de categoría inicial.
 * @returns Línea de borrador.
 */
export function makeDraftLine(categoryId: number): DraftLine {
  return {
    key: crypto.randomUUID(),
    categoryId,
    formatId: null,
    finish: "",
    service: "",
    quantity: "1",
    unitPrice: "",
  };
}

/**
 * Filtra filas de precio por categoría y formato opcional.
 */
export function filterPricesByCategory(
  prices: PriceRowDto[],
  categoryId: number,
  formatId: number | null,
): PriceRowDto[] {
  return prices.filter((row) => {
    if (row.categoryId !== categoryId) {
      return false;
    }
    if (formatId !== null && row.formatId !== formatId) {
      return false;
    }
    return true;
  });
}

/**
 * Valores únicos no vacíos de un campo en filas de precio.
 */
function uniqueValues(rows: PriceRowDto[], field: "service" | "finish"): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const value = field === "service" ? row.service : row.finish;
    if (value?.trim()) {
      set.add(value.trim());
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Formatos disponibles en lista de precios para una categoría.
 */
export function formatOptionsForCategory(
  prices: PriceRowDto[],
  categoryId: number,
  allFormats: { id: number; label: string }[],
): { id: number; label: string }[] {
  const ids = new Set(
    filterPricesByCategory(prices, categoryId, null)
      .map((row) => row.formatId)
      .filter((id): id is number => id !== null),
  );
  return allFormats.filter((f) => ids.has(f.id));
}

/**
 * Opciones de servicio y acabado derivadas de la lista de precios.
 */
export function serviceAndFinishOptions(
  prices: PriceRowDto[],
  categoryId: number,
  formatId: number | null,
): { services: string[]; finishes: string[] } {
  const rows = filterPricesByCategory(prices, categoryId, formatId);
  return {
    services: uniqueValues(rows, "service"),
    finishes: uniqueValues(rows, "finish"),
  };
}

/**
 * Resuelve precio unitario desde filas filtradas según servicio y acabado.
 */
export function resolvePriceFromRows(
  rows: PriceRowDto[],
  service: string,
  finish: string,
): number | null {
  const norm = (v: string) => v.trim().toLowerCase();
  const wantService = norm(service);
  const wantFinish = norm(finish);
  const match = rows.find((row) => {
    const rowService = norm(row.service ?? "");
    const rowFinish = norm(row.finish ?? "");
    return rowService === wantService && rowFinish === wantFinish;
  });
  return match?.price ?? null;
}

/**
 * Autocompleta servicio, acabado y precio cuando la combinación es única.
 */
export function autoFillLineFromPrices(
  prices: PriceRowDto[],
  line: DraftLine,
): Partial<DraftLine> {
  const rows = filterPricesByCategory(prices, line.categoryId, line.formatId);
  if (rows.length === 0) {
    return { service: "", finish: "", unitPrice: "" };
  }

  const { services, finishes } = serviceAndFinishOptions(prices, line.categoryId, line.formatId);
  const patch: Partial<DraftLine> = {};

  let service = line.service;
  let finish = line.finish;

  if (!service && services.length === 1) {
    service = services[0] ?? "";
    patch.service = service;
  }
  if (!finish && finishes.length === 1) {
    finish = finishes[0] ?? "";
    patch.finish = finish;
  }

  if (service || finish) {
    const filtered = rows.filter((row) => {
      const matchService = !service || (row.service ?? "").trim().toLowerCase() === service.trim().toLowerCase();
      const matchFinish = !finish || (row.finish ?? "").trim().toLowerCase() === finish.trim().toLowerCase();
      return matchService && matchFinish;
    });
    if (filtered.length === 1) {
      const only = filtered[0];
      patch.service = only?.service?.trim() ?? service;
      patch.finish = only?.finish?.trim() ?? finish;
      patch.unitPrice = only ? String(only.price) : "";
      return patch;
    }
  }

  if (rows.length === 1 && rows[0]) {
    const only = rows[0];
    patch.service = only.service?.trim() ?? "";
    patch.finish = only.finish?.trim() ?? "";
    patch.unitPrice = String(only.price);
  }

  return patch;
}

/**
 * Calcula subtotal de una línea de borrador.
 */
export function draftLineSubtotal(line: DraftLine): number {
  const qty = Number.parseInt(line.quantity, 10);
  const unit = Number.parseFloat(line.unitPrice.replace(",", "."));
  if (!Number.isFinite(qty) || !Number.isFinite(unit)) {
    return 0;
  }
  return qty * unit;
}

/**
 * Indica si la línea tiene datos mínimos válidos para guardar.
 */
export function isDraftLineValid(line: DraftLine): boolean {
  const qty = Number.parseInt(line.quantity, 10);
  const unit = Number.parseFloat(line.unitPrice.replace(",", "."));
  return line.categoryId > 0 && Number.isFinite(qty) && qty > 0 && Number.isFinite(unit) && unit >= 0;
}
