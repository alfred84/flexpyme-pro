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
  unitId: number | null;
  unitSnapshot: string | null;
  unit: string;
  quantity: number;
  minStock: number;
  costPerUnit: number;
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
  /** `Manual` | `Rebaja por Pedido` | `—` */
  method: string;
}

/**
 * Payload de creación de ítem de inventario.
 */
export interface CreateItemPayload {
  name: string;
  materialCategoryId: number;
  category?: string | null;
  unitId?: number | null;
  unit?: string | null;
  quantity: number;
  minStock: number;
  costPerUnit: number;
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
  unitId?: number | null;
  unit?: string | null;
  minStock: number;
  costPerUnit: number;
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
