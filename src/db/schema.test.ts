import { describe, expect, it } from "vitest";
import {
  cashSessions,
  cashTransactions,
  clients,
  costList,
  employees,
  formats,
  inventoryItems,
  inventoryMovements,
  invoiceItems,
  invoices,
  priceList,
  productCategories,
  productionBatchItems,
  productionBatches,
  settings,
} from "@/db/schema";

describe("database schema", () => {
  it("defines all required tables", () => {
    expect(clients).toBeDefined();
    expect(productCategories).toBeDefined();
    expect(formats).toBeDefined();
    expect(priceList).toBeDefined();
    expect(invoices).toBeDefined();
    expect(invoiceItems).toBeDefined();
    expect(productionBatches).toBeDefined();
    expect(productionBatchItems).toBeDefined();
    expect(cashSessions).toBeDefined();
    expect(settings).toBeDefined();
  });

  it("defines v2 tables (employees, inventory, cashflow, costs)", () => {
    expect(costList).toBeDefined();
    expect(employees).toBeDefined();
    expect(inventoryItems).toBeDefined();
    expect(inventoryMovements).toBeDefined();
    expect(cashTransactions).toBeDefined();
  });
});
