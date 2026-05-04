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
});

export const formats = sqliteTable("formats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  label: text("label").notNull().unique(),
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
  totalCost: real("total_cost").notNull().default(0),
  paid: real("paid").notNull().default(0),
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
