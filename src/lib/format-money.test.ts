import { describe, expect, it } from "vitest";
import { formatAmount, formatMoney, moneyHeading } from "@/lib/format-money";

describe("formatAmount", () => {
  it("formatea sin código de moneda", () => {
    const text = formatAmount(1234.5);
    expect(text.startsWith("$ ")).toBe(true);
    expect(text.includes("CUP")).toBe(false);
    expect(text.includes("USD")).toBe(false);
  });

  it("tolera valores no finitos", () => {
    expect(formatAmount(Number.NaN)).toMatch(/\$ 0[,.]00/);
  });
});

describe("moneyHeading", () => {
  it("añade (CUP) por defecto", () => {
    expect(moneyHeading("Facturación del mes")).toBe("Facturación del mes (CUP)");
  });

  it("añade (USD) cuando se indica", () => {
    expect(moneyHeading("Balance", "USD")).toBe("Balance (USD)");
  });
});

describe("formatMoney", () => {
  it("incluye código CUP por defecto", () => {
    expect(formatMoney(12.5).endsWith(" CUP")).toBe(true);
  });

  it("incluye código USD cuando se indica", () => {
    expect(formatMoney(12.5, "USD").endsWith(" USD")).toBe(true);
  });
});
