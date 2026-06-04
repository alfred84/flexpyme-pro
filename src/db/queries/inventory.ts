import { invoke } from "@tauri-apps/api/core";
import type {
  CreateItemPayload,
  InventoryItemDto,
  InventoryMovementDto,
  MovementPayload,
  UpdateItemPayload,
} from "@/types/inventory";

/**
 * Lists all inventory items (low-stock first).
 */
export async function fetchInventoryItems(): Promise<InventoryItemDto[]> {
  return invoke<InventoryItemDto[]>("inventory_items_list");
}

/**
 * Loads a single inventory item.
 */
export async function fetchInventoryItem(id: number): Promise<InventoryItemDto> {
  return invoke<InventoryItemDto>("inventory_item_get", { id });
}

/**
 * Creates an inventory item; returns the new id.
 */
export async function createInventoryItem(payload: CreateItemPayload): Promise<number> {
  return invoke<number>("inventory_item_create", { payload });
}

/**
 * Updates an inventory item.
 */
export async function updateInventoryItem(payload: UpdateItemPayload): Promise<void> {
  return invoke<void>("inventory_item_update", { payload });
}

/**
 * Registers a stock movement (entrada/salida).
 */
export async function registerInventoryMovement(payload: MovementPayload): Promise<void> {
  return invoke<void>("inventory_movement_register", { payload });
}

/**
 * Lists movements for an item.
 */
export async function fetchInventoryMovements(itemId: number): Promise<InventoryMovementDto[]> {
  return invoke<InventoryMovementDto[]>("inventory_movements_for_item", { itemId });
}
