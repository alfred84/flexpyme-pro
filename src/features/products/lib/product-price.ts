import type { PriceRowDto } from "@/types/price";

/**
 * Normaliza acabado para comparar filas de producto.
 *
 * @param value - Acabado o vacío.
 * @returns Texto en minúsculas sin espacios extremos.
 */
export function normalizeProductFinish(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Indica si la fila tiene un precio de venta usable.
 *
 * @param row - Fila de lista de precios.
 * @returns `true` si hay CUP o USD ofertado.
 */
export function priceRowHasSalePrice(row: PriceRowDto): boolean {
  if (row.isUsdActive && row.priceUsd != null && Number.isFinite(row.priceUsd) && row.priceUsd > 0) {
    return true;
  }
  const cup = row.priceCup ?? row.price;
  if (row.isCupActive && Number.isFinite(cup) && cup > 0) {
    return true;
  }
  return Number.isFinite(row.price) && row.price > 0;
}

/**
 * Indica si la fila corresponde al producto terminado (categoría + formato + acabado).
 *
 * @param row - Fila de precio.
 * @param categoryId - Categoría.
 * @param formatId - Formato.
 * @param finish - Acabado.
 * @returns `true` si coincide el producto.
 */
export function priceRowMatchesProduct(
  row: PriceRowDto,
  categoryId: number,
  formatId: number | null,
  finish: string | null | undefined,
): boolean {
  return (
    row.categoryId === categoryId &&
    row.formatId === formatId &&
    normalizeProductFinish(row.finish) === normalizeProductFinish(finish)
  );
}

/**
 * Elige la fila canónica de precio de venta del producto (ignora el tipo de trabajo).
 *
 * @param prices - Lista de precios.
 * @param categoryId - Categoría.
 * @param formatId - Formato.
 * @param finish - Acabado.
 * @returns Fila con precio de venta, o `undefined`.
 */
export function findProductPriceRow(
  prices: PriceRowDto[],
  categoryId: number,
  formatId: number | null,
  finish: string | null | undefined,
): PriceRowDto | undefined {
  const rows = prices.filter((row) => priceRowMatchesProduct(row, categoryId, formatId, finish));
  const withSale = rows.filter(priceRowHasSalePrice);
  return (
    withSale.find((row) => row.isActive) ??
    withSale[0] ??
    rows.find((row) => row.isActive) ??
    rows[0]
  );
}

/**
 * Copia CUP/USD y flags de oferta desde el precio único del producto.
 * La tarifa de pago (`cost`) no se toca.
 *
 * @param row - Fila (por tipo de trabajo) a mostrar.
 * @param product - Fila canónica del producto, si existe.
 * @returns Fila con precios de venta unificados.
 */
export function applyProductSalePrice<T extends Pick<
  PriceRowDto,
  "price" | "priceCup" | "priceUsd" | "isCupActive" | "isUsdActive"
>>(row: T, product: PriceRowDto | undefined): T {
  if (!product) {
    return row;
  }
  return {
    ...row,
    price: product.price,
    priceCup: product.priceCup,
    priceUsd: product.priceUsd,
    isCupActive: product.isCupActive,
    isUsdActive: product.isUsdActive,
  };
}
