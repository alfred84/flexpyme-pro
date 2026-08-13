import { invoke } from "@tauri-apps/api/core";
import type {
  CreateItemPayload,
  CreateRecipePayload,
  InventoryItemDto,
  InventoryMovementDto,
  InventoryMovementListDto,
  InventoryPendingDemandDto,
  InventoryRecipeDto,
  MaterialCategoryDto,
  MovementPayload,
  UpdateItemPayload,
  UpdateRecipePayload,
  InvoiceMaterialWasteDto,
  RegisterMermaPayload,
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
 * Lista ítems con demanda pendiente de pedidos abiertos (necesario > disponible).
 */
export async function fetchInventoryPendingOrderDemand(): Promise<InventoryPendingDemandDto[]> {
  return invoke<InventoryPendingDemandDto[]>("inventory_pending_order_demand");
}

/**
 * Lists movements for an item.
 */
export async function fetchInventoryMovements(itemId: number): Promise<InventoryMovementDto[]> {
  return invoke<InventoryMovementDto[]>("inventory_movements_for_item", { itemId });
}

/**
 * Lists inventory movements for the current day (`hoy`), month (`mes`) or all (`todos`).
 *
 * @param period - Periodo del listado.
 * @returns Movimientos ordenados del más reciente al más antiguo.
 */
export async function fetchInventoryMovementsList(
  period: "hoy" | "mes" | "todos",
): Promise<InventoryMovementListDto[]> {
  return invoke<InventoryMovementListDto[]>("inventory_movements_list", { period });
}

/**
 * Lists material categories.
 */
export async function fetchMaterialCategories(activeOnly = false): Promise<MaterialCategoryDto[]> {
  return invoke<MaterialCategoryDto[]>("inventory_material_categories_list", { activeOnly });
}

/**
 * Creates a material category.
 */
export async function createMaterialCategory(payload: {
  name: string;
  description?: string | null;
  sortOrder?: number;
}): Promise<MaterialCategoryDto> {
  return invoke<MaterialCategoryDto>("inventory_material_category_create", {
    name: payload.name,
    description: payload.description ?? null,
    sortOrder: payload.sortOrder ?? 10,
  });
}

/**
 * Updates a material category.
 */
export async function updateMaterialCategory(
  id: number,
  payload: { name: string; description?: string | null; sortOrder?: number },
): Promise<MaterialCategoryDto> {
  return invoke<MaterialCategoryDto>("inventory_material_category_update", {
    id,
    name: payload.name,
    description: payload.description ?? null,
    sortOrder: payload.sortOrder ?? 10,
  });
}

/**
 * Deactivates a material category.
 */
export async function deactivateMaterialCategory(id: number): Promise<void> {
  return invoke<void>("inventory_material_category_deactivate", { id });
}

/**
 * Reactivates a material category.
 */
export async function reactivateMaterialCategory(id: number): Promise<MaterialCategoryDto> {
  return invoke<MaterialCategoryDto>("inventory_material_category_reactivate", { id });
}

/**
 * Lists production consumption norms.
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
 * Updates a production consumption norm.
 */
export async function updateInventoryRecipe(payload: UpdateRecipePayload): Promise<InventoryRecipeDto> {
  return invoke<InventoryRecipeDto>("inventory_recipe_update", { payload });
}

/**
 * Deactivates a production consumption norm.
 */
export async function deactivateInventoryRecipe(id: number): Promise<void> {
  return invoke<void>("inventory_recipe_deactivate", { id });
}

/**
 * Reactivates a production consumption norm.
 */
export async function reactivateInventoryRecipe(id: number): Promise<InventoryRecipeDto> {
  return invoke<InventoryRecipeDto>("inventory_recipe_reactivate", { id });
}

/**
 * Lista las mermas de material registradas en un pedido.
 *
 * @param invoiceId - Id del pedido.
 * @returns Mermas más recientes primero.
 */
export async function fetchInvoiceMaterialWastes(
  invoiceId: number,
): Promise<InvoiceMaterialWasteDto[]> {
  return invoke<InvoiceMaterialWasteDto[]>("invoice_material_wastes_list", { invoiceId });
}

/**
 * Registra mermas de un pedido: descuenta almacén y guarda costo snapshot.
 * No modifica el precio de venta del pedido.
 *
 * @param payload - Pedido y líneas de merma.
 * @returns Listado actualizado de mermas del pedido.
 */
export async function registerInvoiceMaterialWaste(
  payload: RegisterMermaPayload,
): Promise<InvoiceMaterialWasteDto[]> {
  return invoke<InvoiceMaterialWasteDto[]>("invoice_material_waste_register", { payload });
}
