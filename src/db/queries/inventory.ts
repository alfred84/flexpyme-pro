import { invoke } from "@tauri-apps/api/core";
import type {
  CreateItemPayload,
  CreateRecipePayload,
  InventoryItemDto,
  InventoryMovementDto,
  InventoryRecipeDto,
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

/**
 * Lists production consumption norms (normas de consumo).
 */
export async function fetchInventoryRecipes(activeOnly = true): Promise<InventoryRecipeDto[]> {
  return invoke<InventoryRecipeDto[]>("inventory_recipes_list", { activeOnly });
}

/**
 * Creates a production consumption norm.
 */
export async function createInventoryRecipe(payload: CreateRecipePayload): Promise<InventoryRecipeDto> {
  return invoke<InventoryRecipeDto>("inventory_recipe_create", { payload });
}

/**
 * Deactivates a production consumption norm.
 */
export async function deactivateInventoryRecipe(id: number): Promise<void> {
  return invoke<void>("inventory_recipe_deactivate", { id });
}
