/**
 * Categoría de material de inventario.
 */
export interface MaterialCategoryDto {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

/**
 * Ítem de inventario con bandera de stock bajo calculada en backend.
 */
export interface InventoryItemDto {
  id: number;
  name: string;
  category: string | null;
  materialCategoryId: number | null;
  materialCategoryName: string | null;
  /** Formato del catálogo de Configuración. */
  formatId: number | null;
  formatLabel: string | null;
  unitId: number | null;
  unitSnapshot: string | null;
  unit: string;
  quantity: number;
  minStock: number;
  costPerUnit: number;
  /** Costo unitario opcional en USD (0 = sin establecer). */
  costPerUnitUsd: number;
  supplier: string | null;
  notes: string | null;
  lowStock: boolean;
  deficit: boolean;
}

/**
 * Demanda pendiente de pedidos abiertos sobre un ítem (necesario > disponible).
 */
export interface InventoryPendingDemandDto {
  inventoryItemId: number;
  itemName: string;
  unit: string;
  available: number;
  needed: number;
  shortfall: number;
  openOrderCount: number;
}

/**
 * Movimiento de stock (entrada/salida).
 */
export interface InventoryMovementDto {
  id: number;
  itemId: number;
  movementType: string;
  quantity: number;
  reason: string | null;
  date: string;
  notes: string | null;
}

/**
 * Movimiento en el listado global de Inventario.
 */
export interface InventoryMovementListDto {
  id: number;
  itemId: number;
  itemName: string;
  movementType: string;
  quantity: number;
  reason: string | null;
  date: string;
  notes: string | null;
  referenceId: number | null;
  /** `Manual` | `Rebaja por Pedido` | `Merma` | `Venta` | `—` */
  method: string;
}

/** Moneda de cobro de una venta de material. */
export type MaterialSalePaymentCurrency = "CUP" | "USD" | "mixto";

/**
 * Payload para registrar una venta de material (salida de stock + ingreso en caja).
 */
export interface RegisterMaterialSalePayload {
  inventoryItemId: number;
  quantity: number;
  paymentMethod: "efectivo" | "transferencia";
  paymentCurrency: MaterialSalePaymentCurrency;
  amountCup: number;
  amountUsd: number;
  exchangeRate: number;
  denominationBreakdown: string | null;
  transferConcept: string | null;
  notes: string | null;
}

/** Periodo del resumen de consumo de materiales. */
export type InventoryConsumptionPeriod = "hoy" | "mes" | "todos";

/**
 * Fila del resumen de consumo de un ítem de inventario.
 */
export interface InventoryConsumptionRowDto {
  itemId: number;
  /** Nombre del ítem (columna «Formato» de la vista). */
  formato: string;
  unit: string;
  materialCategoryId: number | null;
  materialCategoryName: string;
  existenciaInicial: number;
  entradas: number;
  salidas: number;
  solicitados: number;
  mermas: number;
  ventas: number;
  existenciaFinal: number;
  demanda: number;
  deficit: number;
  disponible: number;
}

/**
 * Payload de creación de ítem de inventario.
 */
export interface CreateItemPayload {
  name: string;
  materialCategoryId: number;
  category?: string | null;
  /** Si se omite, el backend usa «Sin formato». */
  formatId?: number | null;
  unitId?: number | null;
  unit?: string | null;
  quantity: number;
  minStock: number;
  costPerUnit: number;
  costPerUnitUsd: number;
  supplier: string | null;
  notes: string | null;
}

/**
 * Payload de actualización de ítem (la cantidad cambia solo vía movimientos).
 */
export interface UpdateItemPayload {
  id: number;
  name: string;
  materialCategoryId: number;
  category?: string | null;
  formatId?: number | null;
  unitId?: number | null;
  unit?: string | null;
  minStock: number;
  costPerUnit: number;
  costPerUnitUsd: number;
  supplier: string | null;
  notes: string | null;
}

/**
 * Payload de registro de movimiento de stock.
 */
export interface MovementPayload {
  itemId: number;
  movementType: "entrada" | "salida";
  quantity: number;
  reason: string | null;
  notes: string | null;
}

/**
 * Norma de consumo de inventario.
 */
export interface InventoryRecipeDto {
  id: number;
  categoryId: number;
  categoryName: string;
  service: string | null;
  workTypeId: number | null;
  workTypeName: string | null;
  formatId: number | null;
  formatLabel: string | null;
  finish: string | null;
  inventoryItemId: number;
  inventoryItemName: string;
  quantityPerUnit: number;
  isActive: boolean;
}

/**
 * Payload de creación de norma de consumo.
 */
export interface CreateRecipePayload {
  categoryId: number;
  workTypeId: number;
  formatId: number | null;
  finish: string | null;
  inventoryItemId: number;
  quantityPerUnit: number;
}

/**
 * Payload de actualización de norma.
 */
export interface UpdateRecipePayload {
  id: number;
  inventoryItemId: number;
  formatId: number | null;
  finish: string | null;
  quantityPerUnit: number;
}

/**
 * Material asignado a una línea de pedido.
 */
export interface InvoiceItemMaterialInput {
  inventoryItemId: number;
  quantityPerUnit: number;
  source?: string | null;
  recipeId?: number | null;
}

/** Motivos de merma de producción (códigos persistidos). */
export type MermaReasonCode =
  | "error_impresion"
  | "material_defectuoso"
  | "error_corte"
  | "otro";

/**
 * Línea de merma a registrar sobre un pedido.
 */
export interface RegisterMermaLinePayload {
  inventoryItemId: number;
  quantity: number;
  reasonCode: MermaReasonCode;
  notes: string | null;
}

/**
 * Payload para registrar mermas de un pedido.
 */
export interface RegisterMermaPayload {
  invoiceId: number;
  items: RegisterMermaLinePayload[];
}

/**
 * Merma persistida de un pedido (costo snapshot; no altera el precio al cliente).
 */
export interface InvoiceMaterialWasteDto {
  id: number;
  invoiceId: number;
  inventoryItemId: number;
  itemName: string;
  unit: string;
  quantity: number;
  reasonCode: MermaReasonCode;
  reasonLabel: string;
  notes: string | null;
  costPerUnitCup: number;
  costPerUnitUsd: number;
  costCup: number;
  costUsd: number;
  inventoryMovementId: number | null;
  createdAt: string;
}
