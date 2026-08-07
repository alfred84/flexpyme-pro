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

  return Array.from(groups.values());
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
