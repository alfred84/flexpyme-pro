import { SIN_FORMATO_LABEL } from "@/lib/formats";
import type { CategoryWorkTypeDto } from "@/types/category";
import type { CreateInvoiceItemPayload } from "@/types/invoice";
import type { InventoryRecipeDto, InvoiceItemMaterialInput } from "@/types/inventory";
import type { PriceRowDto } from "@/types/price";

/**
 * Servicio/tipo de trabajo seleccionado dentro de una línea con su precio.
 */
export interface DraftLineService {
  /** Nombre del tipo de trabajo (se guarda en `invoice_items.service`). */
  service: string;
  unitPrice: string;
  /** Empleados asignados a este tipo de trabajo (máx. = cantidad de la línea). */
  assignments?: DraftServiceAssignment[];
}

/**
 * Empleado asignado a un tipo de trabajo en el borrador de línea.
 */
export interface DraftServiceAssignment {
  employeeId: number;
  employeeName: string;
  /** Tarifa personalizada; vacío = usar tarifa de Precios. */
  customUnitCost: string;
}

/**
 * Cómo se asocian materiales de inventario a la línea.
 * - `norma`: usa normas activas (se fijan al crear el pedido).
 * - `manual`: el usuario elige materiales y cantidades.
 */
export type DraftMaterialMode = "norma" | "manual";

/**
 * Material asignado manualmente en el borrador de línea.
 */
export interface DraftLineMaterial {
  /** Categoría de material de inventario (UI). */
  materialCategoryId: number;
  inventoryItemId: number;
  quantityPerUnit: string;
  /** Etiqueta solo para UI. */
  label?: string;
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
  /** Norma automática o asignación manual de materiales. */
  materialMode: DraftMaterialMode;
  /** Solo usado cuando `materialMode === "manual"`. */
  materials: DraftLineMaterial[];
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
    materialMode: "manual",
    materials: [],
  };
}

/**
 * Resuelve materiales de normas activas que coinciden con la línea/servicio.
 *
 * @param recipes - Normas activas.
 * @param categoryWorkTypes - Tipos vinculados a categorías.
 * @param categoryId - Categoría del pedido.
 * @param formatId - Formato.
 * @param finish - Acabado.
 * @param serviceName - Nombre del tipo de trabajo en la línea.
 * @returns Materiales a persistir en el ítem de factura.
 */
export function resolveRecipeMaterials(
  recipes: InventoryRecipeDto[],
  categoryWorkTypes: CategoryWorkTypeDto[],
  categoryId: number,
  formatId: number | null,
  finish: string | null,
  serviceName: string | null,
): InvoiceItemMaterialInput[] {
  const wantFinish = (finish ?? "").trim().toLowerCase();
  const wantService = (serviceName ?? "").trim().toLowerCase();
  const workTypeId =
    categoryWorkTypes.find(
      (wt) =>
        wt.categoryId === categoryId &&
        wt.workTypeActive &&
        wt.workTypeName.trim().toLowerCase() === wantService,
    )?.workTypeId ?? null;

  return recipes
    .filter((r) => {
      if (!r.isActive || r.categoryId !== categoryId) return false;
      if (r.workTypeId != null && workTypeId != null && r.workTypeId !== workTypeId) {
        return false;
      }
      if (r.workTypeId == null && r.service) {
        if (r.service.trim().toLowerCase() !== wantService) return false;
      }
      if (r.formatId != null && r.formatId !== formatId) return false;
      if (r.finish) {
        if (r.finish.trim().toLowerCase() !== wantFinish) return false;
      }
      return true;
    })
    .map((r) => ({
      inventoryItemId: r.inventoryItemId,
      quantityPerUnit: r.quantityPerUnit,
      source: "recipe",
      recipeId: r.id,
    }));
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
 * Formatos disponibles para una categoría.
 * Prioriza `category_formats`; si no hay, cae a los formatos con precio en la lista.
 *
 * @param prices - Lista de precios.
 * @param categoryId - Categoría a filtrar.
 * @param allFormats - Todos los formatos con su etiqueta.
 * @param categoryFormats - Formatos vinculados por categoría (opcional).
 * @returns Formatos disponibles para la categoría.
 */
export function formatOptionsForCategory(
  prices: PriceRowDto[],
  categoryId: number,
  allFormats: { id: number; label: string }[],
  categoryFormats?: {
    categoryId: number;
    formatId: number;
    formatLabel: string;
    formatActive: boolean;
  }[],
): { id: number; label: string }[] {
  if (categoryFormats) {
    const configured = categoryFormats.filter(
      (row) => row.categoryId === categoryId && row.formatActive,
    );
    if (configured.length > 0) {
      return configured
        .map((row) => ({ id: row.formatId, label: row.formatLabel }))
        .sort((a, b) => a.label.localeCompare(b.label, "es"));
    }
  }
  const ids = new Set(
    filterPricesByCategory(prices, categoryId, null)
      .map((row) => row.formatId)
      .filter((id): id is number => id !== null),
  );
  const fromPrices = allFormats.filter((f) => ids.has(f.id));
  if (fromPrices.length > 0) {
    return fromPrices.sort((a, b) => a.label.localeCompare(b.label, "es"));
  }
  const sinFormato = allFormats.find((f) => f.label.trim().toLowerCase() === SIN_FORMATO_LABEL.toLowerCase());
  return sinFormato ? [sinFormato] : [];
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
 * Convierte una fila de precio a importe unitario en CUP según monedas activas.
 * Prioriza USD (default de venta); si solo CUP está activo, usa CUP.
 *
 * @param row - Fila de precio.
 * @param exchangeRate - Tasa USD→CUP vigente.
 * @returns Precio en CUP o `null` si no hay oferta usable.
 */
export function resolveSaleUnitPriceCup(
  row: PriceRowDto | undefined,
  exchangeRate: number,
): number | null {
  if (!row || !row.isActive) {
    return null;
  }
  if (row.isUsdActive) {
    const usd = row.priceUsd;
    if (usd != null && Number.isFinite(usd) && usd > 0) {
      if (!(exchangeRate > 0)) {
        return null;
      }
      return usd * exchangeRate;
    }
  }
  if (row.isCupActive) {
    const cup = row.priceCup ?? row.price;
    if (Number.isFinite(cup) && cup > 0) {
      return cup;
    }
  }
  if (Number.isFinite(row.price) && row.price > 0) {
    return row.price;
  }
  return null;
}

/**
 * Resuelve precio unitario (CUP) desde filas filtradas según servicio y acabado.
 *
 * @param rows - Filas de precio ya filtradas.
 * @param service - Servicio buscado.
 * @param finish - Acabado buscado.
 * @param exchangeRate - Tasa USD→CUP para filas solo-USD.
 * @returns Precio en CUP o `null` si no hay coincidencia usable.
 */
export function resolvePriceFromRows(
  rows: PriceRowDto[],
  service: string,
  finish: string,
  exchangeRate = 0,
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
  return resolveSaleUnitPriceCup(match, exchangeRate);
}

/**
 * Resuelve el precio de un servicio concreto para una categoría/formato/acabado (en CUP).
 *
 * @param prices - Lista de precios.
 * @param categoryId - Categoría.
 * @param formatId - Formato opcional.
 * @param service - Servicio.
 * @param finish - Acabado.
 * @param exchangeRate - Tasa USD→CUP vigente.
 * @returns Precio unitario en CUP o `null`.
 */
export function resolveServicePrice(
  prices: PriceRowDto[],
  categoryId: number,
  formatId: number | null,
  service: string,
  finish: string,
  exchangeRate = 0,
): number | null {
  const rows = filterPricesByCategory(prices, categoryId, formatId);
  return resolvePriceFromRows(rows, service, finish, exchangeRate);
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
  const pricesOk = line.services.every((s) => {
    const unit = Number.parseFloat(s.unitPrice.replace(",", "."));
    return Number.isFinite(unit) && unit >= 0;
  });
  if (!pricesOk) {
    return false;
  }
  if (line.materialMode === "manual") {
    if (line.materials.length === 0) {
      return false;
    }
    return line.materials.every((m) => {
      const q = Number.parseFloat(m.quantityPerUnit.replace(",", "."));
      return m.inventoryItemId > 0 && Number.isFinite(q) && q > 0;
    });
  }
  return true;
}

/**
 * Expande una línea en uno o varios items de factura (uno por servicio).
 *
 * @param line - Línea de borrador válida.
 * @returns Items de factura listos para el backend.
 */
/**
 * Expande una línea en ítems de factura, adjuntando materiales según el modo.
 *
 * @param line - Línea de borrador válida.
 * @param recipes - Normas activas (para modo norma).
 * @param categoryWorkTypes - Tipos de trabajo por categoría.
 * @returns Items de factura listos para el backend.
 */
export function draftLineToItems(
  line: DraftLine,
  recipes: InventoryRecipeDto[] = [],
  categoryWorkTypes: CategoryWorkTypeDto[] = [],
): CreateInvoiceItemPayload[] {
  const quantity = Number.parseInt(line.quantity, 10);
  const finish = line.finish.trim() || null;
  const manualMaterials: InvoiceItemMaterialInput[] =
    line.materialMode === "manual"
      ? line.materials
          .map((m) => ({
            inventoryItemId: m.inventoryItemId,
            quantityPerUnit: Number.parseFloat(m.quantityPerUnit.replace(",", ".")),
            source: "manual",
            recipeId: null,
          }))
          .filter((m) => Number.isFinite(m.quantityPerUnit) && m.quantityPerUnit > 0)
      : [];

  return line.services.map((s) => {
    const service = s.service.trim() || null;
    const materials =
      line.materialMode === "manual"
        ? manualMaterials
        : resolveRecipeMaterials(
            recipes,
            categoryWorkTypes,
            line.categoryId,
            line.formatId,
            finish,
            service,
          );
    return {
      categoryId: line.categoryId,
      formatId: line.formatId,
      finish,
      service,
      quantity,
      unitPrice: Number.parseFloat(s.unitPrice.replace(",", ".")),
      materials: materials.length > 0 ? materials : null,
      assignments:
        (s.assignments ?? []).length > 0
          ? (s.assignments ?? []).map((a) => {
              const raw = a.customUnitCost.trim().replace(",", ".");
              const custom = raw === "" ? null : Number.parseFloat(raw);
              return {
                employeeId: a.employeeId,
                customUnitCost:
                  custom !== null && Number.isFinite(custom) ? custom : null,
              };
            })
          : null,
    };
  });
}
