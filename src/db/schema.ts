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
    /** Deuda abierta (suma de saldos de pedidos). */
    balance: real("balance").notNull().default(0),
    /** Saldo a favor del cliente (crédito disponible). */
    creditBalance: real("credit_balance").notNull().default(0),
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
 * Catálogo global de acabados (Brillo, 3D, Diamantado…).
 * Se asocian a categorías desde Configuración → Categorías.
 */
export const finishes = sqliteTable(
  "finishes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    description: text("description"),
    isActive: integer("is_active").notNull().default(1),
    isSystem: integer("is_system").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    nameUnique: uniqueIndex("finishes_name_unique").on(table.name),
  }),
);

/**
 * Legacy: servicios/áreas por categoría (sustituido por `category_work_types` en la UI).
 * Se conserva el esquema por compatibilidad con bases existentes.
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
 * Acabados asociados a una categoría (catálogo `finishes`).
 * Opcionales en el pedido; `isDefault` preselecciona al crear la línea.
 */
export const categoryFinishes = sqliteTable("category_finishes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => productCategories.id, { onDelete: "cascade" }),
  /** Snapshot del nombre; preferir finishId para el vínculo. */
  finish: text("finish").notNull(),
  finishId: integer("finish_id").references(() => finishes.id, { onDelete: "set null" }),
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
  /** @deprecated Preferir priceCup; se mantiene sincronizado con CUP para compatibilidad. */
  price: real("price").notNull(),
  /** Precio de venta en CUP. */
  priceCup: real("price_cup"),
  /** Precio de venta en USD (opcional). */
  priceUsd: real("price_usd"),
  /** Si el producto se ofrece en CUP. */
  isCupActive: integer("is_cup_active", { mode: "boolean" }).notNull().default(false),
  /** Si el producto se ofrece en USD (moneda de venta por defecto). */
  isUsdActive: integer("is_usd_active", { mode: "boolean" }).notNull().default(true),
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
  /** Total del pedido en USD (precios de venta). */
  totalUsd: real("total_usd").notNull().default(0),
  /** Pagado acumulado en USD. */
  paidUsd: real("paid_usd").notNull().default(0),
  /** Saldo pendiente en USD. */
  balanceUsd: real("balance_usd").notNull().default(0),
  /** Parte del total declarada a cobrar en USD (split Mixto / puro USD). */
  dueUsd: real("due_usd").notNull().default(0),
  /** Parte del total declarada a cobrar en CUP (split Mixto / puro CUP). */
  dueCup: real("due_cup").notNull().default(0),
  /** Crédito de cliente aplicado a este pedido. */
  creditApplied: real("credit_applied").notNull().default(0),
  /** Exceso de cobro dejado como saldo a favor. */
  creditAdded: real("credit_added").notNull().default(0),
  status: text("status").notNull().default("pending"),
  productionStatus: text("production_status").notNull().default("en_produccion"),
  paymentStatus: text("payment_status").notNull().default("pendiente"),
  paymentMethod: text("payment_method"),
  /** `CUP` | `USD` | `mixto`. */
  paymentCurrency: text("payment_currency").default("CUP"),
  exchangeRateSnapshot: real("exchange_rate_snapshot"),
  amountUsd: real("amount_usd").notNull().default(0),
  amountCup: real("amount_cup").notNull().default(0),
  notes: text("notes"),
  productionCompletedAt: text("production_completed_at"),
  inventoryDeductedAt: text("inventory_deducted_at"),
  resourceMissing: integer("resource_missing").notNull().default(0),
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
  /** Precio unitario de venta en USD (fuente de verdad). */
  unitPriceUsd: real("unit_price_usd").notNull().default(0),
  /** Precio unitario en CUP (`unit_price_usd × tasa`). */
  unitPrice: real("unit_price").notNull(),
  subtotal: real("subtotal").notNull(),
  completedQuantity: integer("completed_quantity").notNull().default(0),
  completedAt: text("completed_at"),
  resourceMissing: integer("resource_missing").notNull().default(0),
  resourceNote: text("resource_note"),
  /** Estado productivo de la línea: `en_produccion` | `listo`. */
  productionLineStatus: text("production_line_status").notNull().default("en_produccion"),
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

/**
 * Tipos de trabajo asociados a una categoría (selección múltiple en Configuración).
 */
export const categoryWorkTypes = sqliteTable(
  "category_work_types",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => productCategories.id, { onDelete: "cascade" }),
    workTypeId: integer("work_type_id")
      .notNull()
      .references(() => workTypes.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    uniqueCategoryWorkType: uniqueIndex("category_work_types_unique").on(
      table.categoryId,
      table.workTypeId,
    ),
  }),
);

/**
 * Formatos asociados a una categoría (selección múltiple en Configuración).
 */
export const categoryFormats = sqliteTable(
  "category_formats",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => productCategories.id, { onDelete: "cascade" }),
    formatId: integer("format_id")
      .notNull()
      .references(() => formats.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    uniqueCategoryFormat: uniqueIndex("category_formats_unique").on(
      table.categoryId,
      table.formatId,
    ),
  }),
);

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
  /** Egreso de caja del pago (para reverso mismo día). */
  cashTransactionId: integer("cash_transaction_id"),
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
  amountReceivedUsd: real("amount_received_usd").notNull().default(0),
  changeGivenUsd: real("change_given_usd").notNull().default(0),
  date: text("date").notNull().default(sql`(datetime('now'))`),
  denominationBreakdown: text("denomination_breakdown"),
  changeBreakdown: text("change_breakdown"),
  denominationBreakdownUsd: text("denomination_breakdown_usd"),
  changeBreakdownUsd: text("change_breakdown_usd"),
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
 * Tarifas de pago a empleados (mano de obra) por tipo de trabajo y formato.
 * Se mantiene sincronizada desde Precios (`price_list.cost` → tarifa de pago).
 * Importes en CUP.
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
 * Tipos de trabajo que un rol puede realizar (configurable en Configuración).
 */
export const roleWorkTypes = sqliteTable(
  "role_work_types",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    roleId: integer("role_id")
      .notNull()
      .references(() => employeeRoles.id, { onDelete: "cascade" }),
    workTypeId: integer("work_type_id")
      .notNull()
      .references(() => workTypes.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    uniqueRoleWorkType: uniqueIndex("role_work_types_unique").on(
      table.roleId,
      table.workTypeId,
    ),
  }),
);

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
  /**
   * Modo de pago: `production` | `fixed` | `destajo`.
   * - production: tarifas por trabajo
   * - fixed: salario fijo diario predefinido
   * - destajo: importe obligatorio a definir cada día
   */
  payMode: text("pay_mode").notNull().default("production"),
  /** @deprecated Preferir payMode === 'fixed'; se mantiene sincronizado. */
  hasFixedDailySalary: integer("has_fixed_daily_salary", { mode: "boolean" })
    .notNull()
    .default(false),
  /** Importe CUP del salario fijo diario (solo modo `fixed`). */
  fixedDailySalaryCup: real("fixed_daily_salary_cup").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * Registro diario de salario fijo (pendiente/pagado) por empleado y fecha.
 */
export const employeeDailySalaries = sqliteTable(
  "employee_daily_salaries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    amountCup: real("amount_cup").notNull(),
    paid: real("paid").notNull().default(0),
    status: text("status").notNull().default("pendiente"),
    /** `fixed` | `destajo` */
    kind: text("kind").notNull().default("fixed"),
    /** Egreso de caja del pago (para reverso mismo día). */
    cashTransactionId: integer("cash_transaction_id"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    empDateUnique: uniqueIndex("employee_daily_salaries_emp_date_uidx").on(
      table.employeeId,
      table.date,
    ),
  }),
);

/**
 * Empleados asignados a una línea de pedido (por tipo de trabajo) con tarifa opcional.
 */
export const invoiceItemAssignments = sqliteTable(
  "invoice_item_assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    invoiceItemId: integer("invoice_item_id")
      .notNull()
      .references(() => invoiceItems.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),
    customUnitCost: real("custom_unit_cost"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    uniqueItemEmployee: uniqueIndex("invoice_item_assignments_unique").on(
      table.invoiceItemId,
      table.employeeId,
    ),
  }),
);

/**
 * Roles adicionales que un empleado puede cubrir (multi-rol). El rol principal
 * sigue en `employees.roleId`.
 */
export const employeeExtraRoles = sqliteTable("employee_extra_roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  roleId: integer("role_id")
    .notNull()
    .references(() => employeeRoles.id),
  roleSnapshot: text("role_snapshot"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * Materiales/insumos del taller con control de stock mínimo.
 */
/**
 * Categorías de materiales de inventario (catálogo).
 */
export const inventoryMaterialCategories = sqliteTable("inventory_material_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const inventoryItems = sqliteTable("inventory_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  /** @deprecated Preferir materialCategoryId; se mantiene por compatibilidad. */
  category: text("category"),
  materialCategoryId: integer("material_category_id").references(
    () => inventoryMaterialCategories.id,
  ),
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
 * Normas de consumo de inventario por categoría de pedido, tipo de trabajo,
 * formato y acabado.
 */
export const inventoryRecipes = sqliteTable("inventory_recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => productCategories.id),
  /** @deprecated Preferir workTypeId. */
  service: text("service"),
  workTypeId: integer("work_type_id").references(() => workTypes.id),
  formatId: integer("format_id").references(() => formats.id),
  finish: text("finish"),
  inventoryItemId: integer("inventory_item_id")
    .notNull()
    .references(() => inventoryItems.id),
  quantityPerUnit: real("quantity_per_unit").notNull().default(1),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * Materiales de inventario asignados a una línea de pedido (norma o manual).
 */
export const invoiceItemMaterials = sqliteTable("invoice_item_materials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceItemId: integer("invoice_item_id")
    .notNull()
    .references(() => invoiceItems.id, { onDelete: "cascade" }),
  inventoryItemId: integer("inventory_item_id")
    .notNull()
    .references(() => inventoryItems.id),
  quantityPerUnit: real("quantity_per_unit").notNull().default(1),
  source: text("source").notNull().default("manual"),
  recipeId: integer("recipe_id").references(() => inventoryRecipes.id, {
    onDelete: "set null",
  }),
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

/**
 * Catálogo de tipos de gasto para el módulo Otros gastos (configurable en UI).
 * El nombre se guarda como snapshot en `other_expenses.expense_type`.
 */
export const expenseTypes = sqliteTable("expense_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * Otros gastos operativos (almuerzo, transporte, etc.). Cada gasto genera un
 * `cash_transactions` (egreso) y afecta el flujo de caja diario/mensual.
 */
export const otherExpenses = sqliteTable("other_expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  concept: text("concept").notNull(),
  /** Snapshot del nombre del tipo (`expense_types.name`) al registrar el gasto. */
  expenseType: text("expense_type").notNull().default("Otros"),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "set null" }),
  amountCup: real("amount_cup").notNull().default(0),
  amountUsd: real("amount_usd").notNull().default(0),
  paymentMethod: text("payment_method").notNull().default("efectivo"),
  denominationBreakdown: text("denomination_breakdown"),
  notes: text("notes"),
  cashTransactionId: integer("cash_transaction_id"),
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
