import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/format-money";

describe("formatMoney", () => {
  it("etiqueta CUP por defecto", () => {
    const text = formatMoney(1234.5);
    expect(text.startsWith("$ ")).toBe(true);
    expect(text.endsWith(" CUP")).toBe(true);
    expect(text).toMatch(/1234[,.]50|1\.234[,.]50/);
  });

  it("etiqueta USD cuando se indica", () => {
    const text = formatMoney(12.5, "USD");
    expect(text.startsWith("$ ")).toBe(true);
    expect(text.endsWith(" USD")).toBe(true);
    expect(text).toMatch(/12[,.]50/);
  });

  it("tolera valores no finitos", () => {
    expect(formatMoney(Number.NaN)).toMatch(/\$ 0[,.]00 CUP/);
  });
});
