/**
 * Ítem de inventario con bandera de stock bajo calculada en backend.
 */
export interface InventoryItemDto {
  id: number;
  name: string;
  category: string | null;
  unitId: number | null;
  unitSnapshot: string | null;
  unit: string;
  quantity: number;
  minStock: number;
  costPerUnit: number;
  supplier: string | null;
  notes: string | null;
  lowStock: boolean;
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
 * Payload de creación de ítem de inventario.
 */
export interface CreateItemPayload {
  name: string;
  category: string | null;
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
  category: string | null;
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
 * Norma de consumo de inventario al completar un pedido.
 */
export interface InventoryRecipeDto {
  id: number;
  categoryId: number;
  categoryName: string;
  service: string | null;
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
  service: string | null;
  inventoryItemId: number;
  quantityPerUnit: number;
}
