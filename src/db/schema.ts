import { relations, sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const clients = sqliteTable(
  "clients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    phone: text("phone"),
    address: text("address"),
    notes: text("notes"),
    balance: real("balance").notNull().default(0),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    nameIdx: uniqueIndex("clients_name_code_idx").on(table.name, table.code),
  }),
);

export const productCategories = sqliteTable("product_categories", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  labelEs: text("label_es"),
});

export const formats = sqliteTable("formats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  label: text("label").notNull().unique(),
  widthInches: real("width_inches"),
  heightInches: real("height_inches"),
  isActive: integer("is_active").notNull().default(1),
});

export const priceList = sqliteTable("price_list", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => productCategories.id),
  formatId: integer("format_id").references(() => formats.id),
  finish: text("finish"),
  service: text("service"),
  price: real("price").notNull(),
  cost: real("cost"),
  validFrom: text("valid_from").notNull().default(sql`(date('now'))`),
  isActive: integer("is_active").notNull().default(1),
});

export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceNumber: text("invoice_number").notNull().unique(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id),
  date: text("date").notNull(),
  subtotal: real("subtotal").notNull().default(0),
  advancePayment: real("advance_payment").notNull().default(0),
  previousDebt: real("previous_debt").notNull().default(0),
  total: real("total").notNull().default(0),
  paid: real("paid").notNull().default(0),
  balance: real("balance").notNull().default(0),
  status: text("status").notNull().default("pending"),
  paymentMethod: text("payment_method"),
  notes: text("notes"),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const invoiceItems = sqliteTable("invoice_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => productCategories.id),
  formatId: integer("format_id").references(() => formats.id),
  finish: text("finish"),
  service: text("service"),
  quantity: integer("quantity").notNull().default(0),
  unitPrice: real("unit_price").notNull(),
  subtotal: real("subtotal").notNull(),
});

export const productionBatches = sqliteTable("production_batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  date: text("date").notNull(),
  workerName: text("worker_name"),
  employeeId: integer("employee_id").references(() => employees.id),
  totalCost: real("total_cost").notNull().default(0),
  paid: real("paid").notNull().default(0),
  status: text("status").notNull().default("pendiente"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const productionBatchItems = sqliteTable("production_batch_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  batchId: integer("batch_id")
    .notNull()
    .references(() => productionBatches.id, { onDelete: "cascade" }),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id),
  formatId: integer("format_id").references(() => formats.id),
  category: text("category").notNull(),
  quantity: integer("quantity").notNull(),
  unitCost: real("unit_cost").notNull(),
  subtotal: real("subtotal").notNull(),
});

export const cashSessions = sqliteTable("cash_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id")
    .notNull()
    .references(() => invoices.id),
  totalAmount: real("total_amount").notNull(),
  amountReceived: real("amount_received").notNull(),
  changeGiven: real("change_given").notNull(),
  date: text("date").notNull().default(sql`(datetime('now'))`),
  denominationBreakdown: text("denomination_breakdown"),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/**
 * Precios de COSTO para el cálculo del salario de empleados.
 * Separado de `price_list` (precios de VENTA). Importes en CUP.
 */
export const costList = sqliteTable("cost_list", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workType: text("work_type").notNull(),
  formatId: integer("format_id").references(() => formats.id),
  unitCost: real("unit_cost").notNull(),
  validFrom: text("valid_from").notNull().default(sql`(date('now'))`),
  isActive: integer("is_active").notNull().default(1),
});

/**
 * Empleados del taller. Soft delete con `is_active = false`.
 */
export const employees = sqliteTable("employees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  role: text("role"),
  phone: text("phone"),
  notes: text("notes"),
  isActive: integer("is_active").notNull().default(1),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * Materiales/insumos del taller con control de stock mínimo.
 */
export const inventoryItems = sqliteTable("inventory_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category"),
  unit: text("unit").notNull().default("unidad"),
  quantity: real("quantity").notNull().default(0),
  minStock: real("min_stock").notNull().default(0),
  costPerUnit: real("cost_per_unit").notNull().default(0),
  supplier: text("supplier"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * Movimientos de inventario: entradas (compra) y salidas (uso/producción).
 */
export const inventoryMovements = sqliteTable("inventory_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemId: integer("item_id")
    .notNull()
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  quantity: real("quantity").notNull(),
  reason: text("reason"),
  referenceId: integer("reference_id"),
  date: text("date").notNull().default(sql`(datetime('now'))`),
  notes: text("notes"),
});

/**
 * Flujo de caja general. Toda operación de dinero del taller.
 * Importes principales en CUP; USD opcional con tasa almacenada por operación.
 */
export const cashTransactions = sqliteTable("cash_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  concept: text("concept").notNull(),
  referenceType: text("reference_type"),
  referenceId: integer("reference_id"),
  amountCup: real("amount_cup").notNull().default(0),
  amountUsd: real("amount_usd").notNull().default(0),
  exchangeRate: real("exchange_rate").notNull().default(0),
  paymentMethod: text("payment_method").notNull().default("efectivo"),
  denominationBreakdown: text("denomination_breakdown"),
  date: text("date").notNull().default(sql`(datetime('now'))`),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const clientsRelations = relations(clients, ({ many }) => ({
  invoices: many(invoices),
  productionItems: many(productionBatchItems),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  items: many(invoiceItems),
  cashSessions: many(cashSessions),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
  category: one(productCategories, {
    fields: [invoiceItems.categoryId],
    references: [productCategories.id],
  }),
  format: one(formats, { fields: [invoiceItems.formatId], references: [formats.id] }),
}));

export const employeesRelations = relations(employees, ({ many }) => ({
  batches: many(productionBatches),
}));

export const productionBatchesRelations = relations(productionBatches, ({ one, many }) => ({
  employee: one(employees, {
    fields: [productionBatches.employeeId],
    references: [employees.id],
  }),
  items: many(productionBatchItems),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ many }) => ({
  movements: many(inventoryMovements),
}));

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  item: one(inventoryItems, {
    fields: [inventoryMovements.itemId],
    references: [inventoryItems.id],
  }),
}));

export const costListRelations = relations(costList, ({ one }) => ({
  format: one(formats, { fields: [costList.formatId], references: [formats.id] }),
}));
