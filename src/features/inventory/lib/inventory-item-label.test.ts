import { describe, expect, it } from "vitest";
import {
  formatInventoryItemName,
  formatInventoryMaterialOptionLabel,
} from "@/features/inventory/lib/inventory-item-label";
import { formatMoney } from "@/lib/format-money";
import type { InventoryItemDto } from "@/types/inventory";

function sampleItem(overrides: Partial<InventoryItemDto> = {}): InventoryItemDto {
  return {
    id: 1,
    name: "Vinilo",
    category: null,
    materialCategoryId: 1,
    materialCategoryName: "Lonas",
    formatId: 2,
    formatLabel: "5x7",
    unitId: 1,
    unitSnapshot: "m",
    unit: "m",
    quantity: 12,
    minStock: 0,
    costPerUnit: 50,
    costPerUnitUsd: 0,
    supplier: null,
    notes: null,
    lowStock: false,
    deficit: false,
    ...overrides,
  };
}

describe("formatInventoryItemName", () => {
  it("appends the catalog format", () => {
    expect(formatInventoryItemName(sampleItem())).toBe("Vinilo · 5x7");
  });

  it("keeps the name when format is empty", () => {
    expect(formatInventoryItemName(sampleItem({ formatLabel: null }))).toBe("Vinilo");
  });
});

describe("formatInventoryMaterialOptionLabel", () => {
  it("includes format, stock and CUP cost", () => {
    expect(formatInventoryMaterialOptionLabel(sampleItem())).toBe(
      `Vinilo · 5x7 (12 m · ${formatMoney(50, "CUP")})`,
    );
  });
});
