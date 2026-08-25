import { serviceMatchesWorkType } from "@/features/invoices/lib/work-type-match";
import {
  applyProductSalePrice,
  findProductPriceRow,
  normalizeProductFinish,
} from "@/features/products/lib/product-price";
import { SIN_FORMATO_LABEL } from "@/lib/formats";
import type { CategoryFinishDto, CategoryFormatDto, CategoryWorkTypeDto } from "@/types/category";
import type { PriceRowDto } from "@/types/price";

/**
 * Fila de la tabla de precios (persistida o borrador pendiente de crear).
 */
export interface PriceTableRow extends PriceRowDto {
  /** `true` si aún no existe en `price_list` (precio/tarifa en 0). */
  isDraft: boolean;
}

/**
 * Construye las filas a mostrar para un tipo de trabajo de una categoría.
 * El precio de venta CUP/USD es único del producto (formato + acabado) y se muestra
 * en cada pestaña como referencia; la tarifa de pago sí es por tipo de trabajo.
 *
 * @param args - Datos de categoría, tipo, catálogos y precios.
 * @returns Filas de tabla (reales + borradores).
 */
export function buildPriceTableRows(args: {
  categoryId: number;
  categoryName: string;
  workType: CategoryWorkTypeDto;
  categoryFormats: CategoryFormatDto[];
  categoryFinishes: CategoryFinishDto[];
  prices: PriceRowDto[];
  sinFormato: { id: number; label: string } | null;
}): PriceTableRow[] {
  const {
    categoryId,
    categoryName,
    workType,
    categoryFormats,
    categoryFinishes,
    prices,
    sinFormato,
  } = args;

  const existing = prices.filter(
    (row) =>
      row.categoryId === categoryId &&
      serviceMatchesWorkType(row.service, workType.workTypeCode, workType.workTypeName),
  );

  const linkedFormats = categoryFormats.filter(
    (f) => f.categoryId === categoryId && f.formatActive,
  );
  const formatSlots: { id: number | null; label: string }[] =
    linkedFormats.length > 0
      ? linkedFormats.map((f) => ({ id: f.formatId, label: f.formatLabel }))
      : sinFormato
        ? [{ id: sinFormato.id, label: sinFormato.label }]
        : [{ id: null, label: SIN_FORMATO_LABEL }];

  const linkedFinishes = categoryFinishes.filter(
    (f) => f.categoryId === categoryId && (f.finishActive ?? true),
  );
  const finishSlots: (string | null)[] =
    linkedFinishes.length > 0 ? linkedFinishes.map((f) => f.finish) : [null];

  const usedIds = new Set<number>();
  const rows: PriceTableRow[] = [];
  let draftSeq = 0;

  for (const format of formatSlots) {
    for (const finish of finishSlots) {
      const productSale = findProductPriceRow(prices, categoryId, format.id, finish);
      const match = existing.find(
        (row) =>
          row.formatId === format.id &&
          normalizeProductFinish(row.finish) === normalizeProductFinish(finish),
      );
      if (match) {
        usedIds.add(match.id);
        rows.push({ ...applyProductSalePrice({ ...match, isDraft: false }, productSale) });
        continue;
      }
      draftSeq -= 1;
      rows.push(
        applyProductSalePrice(
          {
            id: draftSeq,
            categoryId,
            categoryName,
            formatId: format.id,
            formatLabel: format.label,
            finish,
            service: workType.workTypeName,
            price: 0,
            priceCup: null,
            priceUsd: null,
            isCupActive: false,
            isUsdActive: true,
            cost: 0,
            validFrom: "",
            isActive: true,
            isDraft: true,
          },
          productSale,
        ),
      );
    }
  }

  for (const row of existing) {
    if (!usedIds.has(row.id)) {
      const productSale = findProductPriceRow(prices, categoryId, row.formatId, row.finish);
      rows.push(applyProductSalePrice({ ...row, isDraft: false }, productSale));
    }
  }

  return rows.sort((a, b) => {
    const formatCmp = (a.formatLabel ?? "").localeCompare(b.formatLabel ?? "", "es");
    if (formatCmp !== 0) {
      return formatCmp;
    }
    return (a.finish ?? "").localeCompare(b.finish ?? "", "es");
  });
}
