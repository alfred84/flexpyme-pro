import type { DraftLine, DraftLineMaterial } from "@/features/invoices/lib/order-draft";
import type { InvoiceItemDto } from "@/types/invoice";
import type { InventoryItemDto } from "@/types/inventory";

/**
 * Agrupa líneas persistidas del pedido en borradores editables (por categoría/formato/acabado/cantidad).
 *
 * @param items - Líneas del detalle.
 * @param inventoryItems - Catálogo para resolver categoría de material.
 * @returns Líneas de borrador para el modal/formulario.
 */
export function invoiceItemsToDraftLines(
  items: InvoiceItemDto[],
  inventoryItems: InventoryItemDto[] = [],
): DraftLine[] {
  const groups = new Map<string, DraftLine>();

  for (const item of items) {
    const key = [
      item.categoryId,
      item.formatId ?? "null",
      (item.finish ?? "").trim().toLowerCase(),
      item.quantity,
    ].join("|");

    let line = groups.get(key);
    if (!line) {
      const materials = materialsFromItem(item, inventoryItems);
      const hasManual = item.materials.some((m) => (m.source || "").toLowerCase() === "manual");
      line = {
        key: crypto.randomUUID(),
        categoryId: item.categoryId,
        formatId: item.formatId,
        finish: item.finish ?? "",
        quantity: String(item.quantity),
        services: [],
        materialMode: hasManual || materials.length > 0 ? (hasManual ? "manual" : "norma") : "norma",
        materials: hasManual ? materials : [],
      };
      groups.set(key, line);
    }

    line.services.push({
      service: item.service ?? "",
      unitPrice: String(item.unitPrice),
      unitPriceUsd: String(item.unitPriceUsd ?? 0),
      assignments: (item.assignments ?? []).map((a) => ({
        employeeId: a.employeeId,
        employeeName: a.employeeName,
        customUnitCost:
          a.customUnitCost !== null && a.customUnitCost !== undefined
            ? String(a.customUnitCost)
            : "",
      })),
    });
  }

  return Array.from(groups.values()).map(unifyDraftLineProductPrice);
}

/**
 * Deja un único precio de producto en todos los tipos de la línea.
 * Si los importes ya coinciden (o solo uno cobra), usa ese valor; si difieren
 * (pedidos antiguos que sumaban tipos), conserva el total.
 *
 * @param line - Línea agrupada.
 * @returns Línea con precios de venta unificados.
 */
function unifyDraftLineProductPrice(line: DraftLine): DraftLine {
  if (line.services.length === 0) {
    return line;
  }
  const cups = line.services.map((s) => {
    const n = Number.parseFloat(s.unitPrice.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  });
  const usds = line.services.map((s) => {
    const n = Number.parseFloat((s.unitPriceUsd ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  });
  const positiveCups = cups.filter((c) => c > 0);
  const positiveUsds = usds.filter((u) => u > 0);
  const cupsEqual =
    positiveCups.length <= 1 ||
    positiveCups.every((c) => Math.abs(c - (positiveCups[0] ?? 0)) < 0.0001);
  const cup = cupsEqual
    ? Math.max(0, ...(positiveCups.length > 0 ? positiveCups : [0]))
    : positiveCups.reduce((sum, c) => sum + c, 0);
  const usdsEqual =
    positiveUsds.length <= 1 ||
    positiveUsds.every((u) => Math.abs(u - (positiveUsds[0] ?? 0)) < 0.0001);
  const usd = usdsEqual
    ? Math.max(0, ...(positiveUsds.length > 0 ? positiveUsds : [0]))
    : positiveUsds.reduce((sum, u) => sum + u, 0);

  return {
    ...line,
    services: line.services.map((s) => ({
      ...s,
      unitPrice: cup > 0 ? String(cup) : s.unitPrice,
      unitPriceUsd: usd > 0 ? String(usd) : s.unitPriceUsd,
    })),
  };
}

/**
 * Convierte materiales de una línea persistida a filas de borrador.
 *
 * @param item - Línea con materiales.
 * @param inventoryItems - Catálogo de inventario.
 * @returns Materiales de borrador.
 */
function materialsFromItem(
  item: InvoiceItemDto,
  inventoryItems: InventoryItemDto[],
): DraftLineMaterial[] {
  return item.materials.map((m) => {
    const inv = inventoryItems.find((it) => it.id === m.inventoryItemId);
    return {
      materialCategoryId: inv?.materialCategoryId ?? 0,
      inventoryItemId: m.inventoryItemId,
      quantityPerUnit: String(m.quantityPerUnit),
      label: inv?.name,
    };
  });
}
