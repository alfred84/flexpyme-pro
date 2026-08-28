import { describe, expect, it } from "vitest";
import type { InventoryConsumptionRowDto } from "@/types/inventory";
import {
  formatConsumptionQty,
  groupConsumptionByCategory,
} from "@/features/inventory/lib/consumption-summary";

function row(
  partial: Pick<InventoryConsumptionRowDto, "itemId" | "formato" | "materialCategoryId" | "materialCategoryName">
    & Partial<InventoryConsumptionRowDto>,
): InventoryConsumptionRowDto {
  return {
    unit: "u",
    existenciaInicial: 0,
    entradas: 0,
    salidas: 0,
    solicitados: 0,
    mermas: 0,
    ventas: 0,
    existenciaFinal: 0,
    demanda: 0,
    deficit: 0,
    disponible: 0,
    ...partial,
  };
}

describe("consumption-summary", () => {
  it("formats quantities without forcing two decimals", () => {
    expect(formatConsumptionQty(10)).toBe("10");
    expect(formatConsumptionQty(1.5)).toMatch(/1[,.]5/);
  });

  it("groups rows by material category and sums deficit per item", () => {
    const groups = groupConsumptionByCategory([
      row({
        itemId: 1,
        formato: "8x10",
        materialCategoryId: 2,
        materialCategoryName: "Marcos",
        existenciaFinal: 4,
        deficit: 1,
        disponible: 0,
      }),
      row({
        itemId: 2,
        formato: "16x20",
        materialCategoryId: 2,
        materialCategoryName: "Marcos",
        existenciaFinal: 7,
        deficit: 0,
        disponible: 3,
      }),
      row({
        itemId: 3,
        formato: "Cristal 8x10",
        materialCategoryId: 5,
        materialCategoryName: "Cristales",
        existenciaFinal: 2,
      }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.materialCategoryName).toBe("Cristales");
    expect(groups[1]?.materialCategoryName).toBe("Marcos");
    expect(groups[1]?.rows).toHaveLength(2);
    expect(groups[1]?.totals.existenciaFinal).toBe(11);
    expect(groups[1]?.totals.deficit).toBe(1);
    expect(groups[1]?.totals.disponible).toBe(3);
  });
});
