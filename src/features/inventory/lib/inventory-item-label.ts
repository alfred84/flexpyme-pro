import { formatMoney } from "@/lib/format-money";
import type { InventoryItemDto } from "@/types/inventory";

/**
 * Etiqueta de opción en selectores de material de inventario.
 * Incluye stock y, si están definidos, los costos unitarios en su moneda
 * (CUP y/o USD independientes) para distinguir ítems con el mismo nombre.
 *
 * @param item - Ítem de inventario.
 * @returns Texto para `<option>` / listas, p. ej. `Vinilo (12 m · $ 50,00 CUP · $ 1,20 USD)`.
 */
export function formatInventoryMaterialOptionLabel(item: InventoryItemDto): string {
  const stockPart = `${item.quantity} ${item.unit}`;
  const costParts: string[] = [];
  if (item.costPerUnit > 0) {
    costParts.push(formatMoney(item.costPerUnit, "CUP"));
  }
  if (item.costPerUnitUsd > 0) {
    costParts.push(formatMoney(item.costPerUnitUsd, "USD"));
  }
  if (costParts.length === 0) {
    return `${item.name} (${stockPart})`;
  }
  return `${item.name} (${stockPart} · ${costParts.join(" · ")})`;
}
