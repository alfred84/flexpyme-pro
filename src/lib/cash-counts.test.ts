import { describe, expect, it } from "vitest";
import {
  buildCountsPayload,
  emptyDenominationCounts,
  serializeDenominationBreakdown,
  sumDenominationCounts,
} from "@/lib/cash-counts";

describe("cash-counts", () => {
  it("creates empty counts for CUP denominations", () => {
    const counts = emptyDenominationCounts("CUP");
    expect(counts["1000"]).toBe(0);
    expect(counts["5000"]).toBe(0);
    expect(sumDenominationCounts(counts, "CUP")).toBe(0);
  });

  it("creates empty counts for USD denominations", () => {
    const counts = emptyDenominationCounts("USD");
    expect(counts["100"]).toBe(0);
    expect(counts["1"]).toBe(0);
    // USD no incluye la denominación 5000 (solo CUP).
    expect(counts["5000"]).toBeUndefined();
  });

  it("sums CUP counts by denomination value", () => {
    const counts = { ...emptyDenominationCounts("CUP"), "1000": 2, "500": 1 };
    expect(sumDenominationCounts(counts, "CUP")).toBe(2500);
  });

  it("sums USD counts by denomination value", () => {
    const counts = { ...emptyDenominationCounts("USD"), "20": 3, "5": 2 };
    expect(sumDenominationCounts(counts, "USD")).toBe(70);
  });

  it("returns null payload when all counts are zero", () => {
    expect(buildCountsPayload(emptyDenominationCounts("CUP"), "CUP")).toBeNull();
  });

  it("serializes a breakdown tagged with its currency", () => {
    const counts = { ...emptyDenominationCounts("USD"), "10": 1 };
    const json = serializeDenominationBreakdown(counts, "USD");
    expect(json).not.toBeNull();
    const parsed = JSON.parse(json ?? "{}");
    expect(parsed.currency).toBe("USD");
    expect(parsed.counts["10"]).toBe(1);
  });

  it("returns null when serializing empty counts", () => {
    expect(serializeDenominationBreakdown(emptyDenominationCounts("CUP"), "CUP")).toBeNull();
  });
});
