import { describe, expect, it } from "vitest";
import { payQuantityForAssignedWorker } from "@/features/invoices/lib/assignment-quantity";

describe("payQuantityForAssignedWorker", () => {
  it("gives each worker the pending units when they outnumber them (collaboration)", () => {
    expect(payQuantityForAssignedWorker(2, 1, 0)).toBe(1);
    expect(payQuantityForAssignedWorker(2, 1, 1)).toBe(1);
    expect(payQuantityForAssignedWorker(3, 1, 2)).toBe(1);
  });

  it("splits one unit per worker and remainder to the last when there are enough units", () => {
    expect(payQuantityForAssignedWorker(2, 5, 0)).toBe(1);
    expect(payQuantityForAssignedWorker(2, 5, 1)).toBe(4);
  });

  it("returns 0 for invalid indexes or empty pending", () => {
    expect(payQuantityForAssignedWorker(2, 0, 0)).toBe(0);
    expect(payQuantityForAssignedWorker(0, 1, 0)).toBe(0);
    expect(payQuantityForAssignedWorker(2, 1, 2)).toBe(0);
  });
});
