import { normalizeProductFinish, priceRowHasSalePrice } from "@/features/products/lib/product-price";
import type {
  CategoryFinishDto,
  CategoryFormatDto,
  CategoryWorkTypeDto,
  ProductCategoryDto,
} from "@/types/category";
import type { PriceRowDto } from "@/types/price";

/** Resumen de una categoría para el listado de Precios. */
export interface PriceCategoryRow {
  id: number;
  name: string;
  description: string | null;
  code: string;
  icon: string | null;
  workTypeNames: string[];
  formatCount: number;
  finishCount: number;
  definedPriceCount: number;
  expectedPriceCount: number;
  pendingPriceCount: number;
  hasUsd: boolean;
  hasCup: boolean;
}

/**
 * Clave de producto terminado (formato + acabado) para contar precios únicos.
 *
 * @param formatId - Formato o nulo.
 * @param finish - Acabado o nulo.
 * @returns Identificador estable.
 */
function productKey(formatId: number | null, finish: string | null): string {
  return `${formatId ?? "none"}|${normalizeProductFinish(finish)}`;
}

/**
 * Construye las filas del listado de categorías de Precios.
 * El precio de venta es único por formato y acabado; si no hay formatos o
 * acabados se cuenta 1 hueco (Sin formato / sin acabado).
 *
 * @param args - Categorías activas y catálogos vinculados.
 * @returns Filas ordenadas por nombre.
 */
export function buildPriceCategoryRows(args: {
  categories: ProductCategoryDto[];
  workTypes: CategoryWorkTypeDto[];
  formats: CategoryFormatDto[];
  finishes: CategoryFinishDto[];
  prices: PriceRowDto[];
}): PriceCategoryRow[] {
  const { categories, workTypes, formats, finishes, prices } = args;

  return categories
    .map((category) => {
      const workTypeNames = workTypes
        .filter((wt) => wt.categoryId === category.id && wt.workTypeActive)
        .map((wt) => wt.workTypeName)
        .sort((a, b) => a.localeCompare(b, "es"));

      const formatCount = formats.filter(
        (fmt) => fmt.categoryId === category.id && fmt.formatActive,
      ).length;
      const finishCount = finishes.filter(
        (fin) => fin.categoryId === category.id && (fin.finishActive ?? true),
      ).length;

      const expectedPriceCount = Math.max(formatCount, 1) * Math.max(finishCount, 1);
      const definedKeys = new Set(
        prices
          .filter((row) => row.categoryId === category.id && row.isActive && priceRowHasSalePrice(row))
          .map((row) => productKey(row.formatId, row.finish)),
      );
      const definedPriceCount = definedKeys.size;
      const pendingPriceCount = Math.max(0, expectedPriceCount - definedPriceCount);

      const categoryPrices = prices.filter((row) => row.categoryId === category.id && row.isActive);
      const hasUsd = categoryPrices.some((row) => row.isUsdActive && (row.priceUsd ?? 0) > 0);
      const hasCup = categoryPrices.some(
        (row) => row.isCupActive && (row.priceCup ?? (row.price > 0 ? row.price : 0)) > 0,
      );

      return {
        id: category.id,
        name: category.name,
        description: category.description,
        code: category.code,
        icon: category.icon,
        workTypeNames,
        formatCount,
        finishCount,
        definedPriceCount,
        expectedPriceCount,
        pendingPriceCount,
        hasUsd,
        hasCup,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/**
 * Filtra el listado de categorías por nombre, código, descripción o tipo de trabajo.
 *
 * @param rows - Filas ya construidas.
 * @param query - Texto de búsqueda (se recorta y compara en minúsculas).
 * @returns Filas que coinciden; si `query` está vacío, todas.
 */
export function filterPriceCategoryRows(rows: PriceCategoryRow[], query: string): PriceCategoryRow[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return rows;
  }
  return rows.filter((row) => {
    const haystack = [
      row.name,
      row.code,
      row.description ?? "",
      ...row.workTypeNames,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}
