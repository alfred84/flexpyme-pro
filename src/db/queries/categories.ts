import { invoke } from "@tauri-apps/api/core";
import type { CreateCategoryPayload, ProductCategoryDto, UpdateCategoryPayload } from "@/types/category";

/**
 * Lista categorías de producto.
 */
export async function fetchCategories(activeOnly: boolean): Promise<ProductCategoryDto[]> {
  return invoke<ProductCategoryDto[]>("get_categories", { activeOnly });
}

/**
 * Crea una categoría personalizada.
 */
export async function createCategory(payload: CreateCategoryPayload): Promise<ProductCategoryDto> {
  return invoke<ProductCategoryDto>("create_category", { data: payload });
}

/**
 * Actualiza una categoría no sistema.
 */
export async function updateCategory(id: number, data: UpdateCategoryPayload): Promise<ProductCategoryDto> {
  return invoke<ProductCategoryDto>("update_category", { id, data });
}

/**
 * Desactiva una categoría personalizada.
 */
export async function deactivateCategory(id: number): Promise<void> {
  return invoke<void>("deactivate_category", { id });
}

/**
 * Reactiva una categoría desactivada.
 */
export async function reactivateCategory(id: number): Promise<ProductCategoryDto> {
  return invoke<ProductCategoryDto>("reactivate_category", { id });
}
