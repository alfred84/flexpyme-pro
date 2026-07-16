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
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
  labelEs: text("label_es"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * Unidades de medida para inventario (catálogo con protección is_system).
 */
export const units = sqliteTable("units", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  abbreviation: text("abbreviation").notNull(),
  type: text("type").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const formats = sqliteTable("formats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  label: text("label").notNull().unique(),
  widthInches: real("width_inches"),
  heightInches: real("height_inches"),
  isActive: integer("is_active").notNull().default(1),
  isSystem: integer("is_system").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * Servicios/áreas configurables por categoría (Impresión, Laminado, Enmarcado...).
 * `isDefault` marca los que se preseleccionan al crear una línea de pedido.
 */
export const categoryServices = sqliteTable("category_services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => productCategories.id, { onDelete: "cascade" }),
  service: text("service").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * Acabados configurables por categoría (Brillo, 3D, Diamantado, Cuero Acrílico...).
 * Opcionales aunque estén definidos.
 */
export const categoryFinishes = sqliteTable("category_finishes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => productCategories.id, { onDelete: "cascade" }),
  finish: text("finish").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
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
  productionStatus: text("production_status").notNull().default("en_produccion"),
  paymentStatus: text("payment_status").notNull().default("pendiente"),
  paymentMethod: text("payment_method"),
  paymentCurrency: text("payment_currency").default("CUP"),
  exchangeRateSnapshot: real("exchange_rate_snapshot"),
  amountUsd: real("amount_usd").notNull().default(0),
  amountCup: real("amount_cup").notNull().default(0),
  notes: text("notes"),
  productionCompletedAt: text("production_completed_at"),
  inventoryDeductedAt: text("inventory_deducted_at"),
  cancelledAt: text("cancelled_at"),
  cancelledReason: text("cancelled_reason"),
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
  categorySnapshot: text("category_snapshot"),
  formatId: integer("format_id").references(() => formats.id),
  formatLabelSnapshot: text("format_label_snapshot"),
  finish: text("finish"),
  service: text("service"),
  quantity: integer("quantity").notNull().default(0),
  unitPrice: real("unit_price").notNull(),
  subtotal: real("subtotal").notNull(),
  completedQuantity: integer("completed_quantity").notNull().default(0),
  completedAt: text("completed_at"),
});

export const workTypes = sqliteTable("work_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  isActive: integer("is_active").notNull().default(1),
  isSystem: integer("is_system").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const productionBatches = sqliteTable("production_batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workTypeId: integer("work_type_id").references(() => workTypes.id),
  workTypeSnapshot: text("work_type_snapshot"),
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
  invoiceId: integer("invoice_id").references(() => invoices.id),
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
  changeBreakdown: text("change_breakdown"),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/**
 * Histórico de cambios de la tasa USD → CUP (auditoría).
 */
export const exchangeRateHistory = sqliteTable("exchange_rate_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rate: real("rate").notNull(),
  effectiveAt: text("effective_at").notNull().default(sql`(datetime('now'))`),
  source: text("source").notNull().default("config"),
  previousRate: real("previous_rate"),
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
 * Roles configurables de empleados (catálogo; solo desactivar, no eliminar).
 */
export const employeeRoles = sqliteTable("employee_roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * Empleados del taller. Soft delete con `is_active = false`.
 */
export const employees = sqliteTable("employees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  roleId: integer("role_id").references(() => employeeRoles.id),
  roleSnapshot: text("role_snapshot"),
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
  unitId: integer("unit_id").references(() => units.id),
  unitSnapshot: text("unit_snapshot"),
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
 * Recetas de consumo de inventario por categoría/servicio de producto vendido.
 */
export const inventoryRecipes = sqliteTable("inventory_recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => productCategories.id),
  service: text("service"),
  inventoryItemId: integer("inventory_item_id")
    .notNull()
    .references(() => inventoryItems.id),
  quantityPerUnit: real("quantity_per_unit").notNull().default(1),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
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
  unitSnapshot: text("unit_snapshot"),
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

export const employeeRolesRelations = relations(employeeRoles, ({ many }) => ({
  employees: many(employees),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  role: one(employeeRoles, { fields: [employees.roleId], references: [employeeRoles.id] }),
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
