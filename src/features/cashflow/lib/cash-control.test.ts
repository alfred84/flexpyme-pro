import { describe, expect, it } from "vitest";
import { countsFromOpeningLines } from "@/features/cashflow/lib/cash-control";
import type { CashControlLineDto } from "@/types/cashflow";

function line(denomination: number, openingQty: number): CashControlLineDto {
  return {
    denomination,
    openingQty,
    inQty: 0,
    outQty: 0,
    estimatedQty: openingQty,
    openingSubtotal: denomination * openingQty,
    estimatedSubtotal: denomination * openingQty,
  };
}

describe("countsFromOpeningLines", () => {
  it("rellena el mapa CUP con las cantidades de saldo inicial", () => {
    const counts = countsFromOpeningLines([line(50, 406), line(20, 241), line(10, 440)], "CUP");
    expect(counts["50"]).toBe(406);
    expect(counts["20"]).toBe(241);
    expect(counts["10"]).toBe(440);
    expect(counts["1000"]).toBe(0);
  });

  it("ignora denominaciones que no pertenecen a la moneda", () => {
    const counts = countsFromOpeningLines([line(2000, 3), line(2, 8)], "USD");
    expect(counts["2"]).toBe(8);
    expect(counts["2000"]).toBeUndefined();
  });
});
