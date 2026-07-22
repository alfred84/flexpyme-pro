import type { CreateInvoiceItemPayload } from "@/types/invoice";
import type { PriceRowDto } from "@/types/price";

/**
 * Servicio/tipo de trabajo seleccionado dentro de una línea con su precio.
 */
export interface DraftLineService {
  /** Nombre del tipo de trabajo (se guarda en `invoice_items.service`). */
  service: string;
  unitPrice: string;
}

/**
 * Línea de borrador en el formulario de nuevo pedido.
 *
 * Una línea representa un producto (categoría) + formato + acabado con una
 * cantidad, y uno o más tipos de trabajo (Impresión, Laminado, Enmarcado...).
 * Al guardar el pedido, cada tipo se expande en un `invoice_item` independiente
 * (el campo `service` almacena el nombre del tipo de trabajo).
 */
export interface DraftLine {
  key: string;
  categoryId: number;
  formatId: number | null;
  finish: string;
  quantity: string;
  /** Tipos de trabajo seleccionados (persistidos como `invoice_items.service`). */
  services: DraftLineService[];
}

/**
 * Crea una línea vacía con categoría por defecto (sin servicios).
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
    quantity: "1",
    services: [],
  };
}

/**
 * Filtra filas de precio por categoría y formato opcional.
 *
 * @param prices - Lista de precios.
 * @param categoryId - Categoría a filtrar.
 * @param formatId - Formato opcional.
 * @returns Filas de precio coincidentes.
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
 *
 * @param rows - Filas de precio.
 * @param field - Campo a extraer (`service` o `finish`).
 * @returns Valores únicos ordenados.
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
 *
 * @param prices - Lista de precios.
 * @param categoryId - Categoría a filtrar.
 * @param allFormats - Todos los formatos con su etiqueta.
 * @returns Formatos con precios definidos para la categoría.
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
 *
 * @param prices - Lista de precios.
 * @param categoryId - Categoría a filtrar.
 * @param formatId - Formato opcional.
 * @returns Servicios y acabados únicos disponibles.
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
 *
 * @param rows - Filas de precio ya filtradas.
 * @param service - Servicio buscado.
 * @param finish - Acabado buscado.
 * @returns Precio o `null` si no hay coincidencia.
 */
export function resolvePriceFromRows(
  rows: PriceRowDto[],
  service: string,
  finish: string,
): number | null {
  const norm = (v: string) => v.trim().toLowerCase();
  const wantService = norm(service);
  const wantFinish = norm(finish);
  const match =
    rows.find((row) => {
      const rowService = norm(row.service ?? "");
      const rowFinish = norm(row.finish ?? "");
      return rowService === wantService && rowFinish === wantFinish;
    }) ??
    // Coincidencia por servicio ignorando el acabado si no hay exacta.
    rows.find((row) => norm(row.service ?? "") === wantService);
  return match?.price ?? null;
}

/**
 * Resuelve el precio de un servicio concreto para una categoría/formato/acabado.
 *
 * @param prices - Lista de precios.
 * @param categoryId - Categoría.
 * @param formatId - Formato opcional.
 * @param service - Servicio.
 * @param finish - Acabado.
 * @returns Precio unitario o `null`.
 */
export function resolveServicePrice(
  prices: PriceRowDto[],
  categoryId: number,
  formatId: number | null,
  service: string,
  finish: string,
): number | null {
  const rows = filterPricesByCategory(prices, categoryId, formatId);
  return resolvePriceFromRows(rows, service, finish);
}

/**
 * Calcula subtotal de una línea de borrador (cantidad × suma de servicios).
 *
 * @param line - Línea de borrador.
 * @returns Importe total de la línea.
 */
export function draftLineSubtotal(line: DraftLine): number {
  const qty = Number.parseInt(line.quantity, 10);
  if (!Number.isFinite(qty)) {
    return 0;
  }
  const servicesTotal = line.services.reduce((sum, s) => {
    const unit = Number.parseFloat(s.unitPrice.replace(",", "."));
    return Number.isFinite(unit) ? sum + unit : sum;
  }, 0);
  return qty * servicesTotal;
}

/**
 * Indica si la línea tiene datos mínimos válidos para guardar.
 *
 * @param line - Línea de borrador.
 * @returns `true` si es válida.
 */
export function isDraftLineValid(line: DraftLine): boolean {
  const qty = Number.parseInt(line.quantity, 10);
  if (line.categoryId <= 0 || !Number.isFinite(qty) || qty <= 0) {
    return false;
  }
  if (line.services.length === 0) {
    return false;
  }
  return line.services.every((s) => {
    const unit = Number.parseFloat(s.unitPrice.replace(",", "."));
    return Number.isFinite(unit) && unit >= 0;
  });
}

/**
 * Expande una línea en uno o varios items de factura (uno por servicio).
 *
 * @param line - Línea de borrador válida.
 * @returns Items de factura listos para el backend.
 */
export function draftLineToItems(line: DraftLine): CreateInvoiceItemPayload[] {
  const quantity = Number.parseInt(line.quantity, 10);
  const finish = line.finish.trim() || null;
  return line.services.map((s) => ({
    categoryId: line.categoryId,
    formatId: line.formatId,
    finish,
    service: s.service.trim() || null,
    quantity,
    unitPrice: Number.parseFloat(s.unitPrice.replace(",", ".")),
  }));
}
