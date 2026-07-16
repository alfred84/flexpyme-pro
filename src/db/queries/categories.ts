import { invoke } from "@tauri-apps/api/core";
import type {
  CategoryFinishDto,
  CategoryServiceDto,
  CreateCategoryPayload,
  ProductCategoryDto,
  UpdateCategoryPayload,
} from "@/types/category";

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

/**
 * Lista todos los servicios configurados por categoría.
 */
export async function fetchCategoryServices(): Promise<CategoryServiceDto[]> {
  return invoke<CategoryServiceDto[]>("category_services_all");
}

/**
 * Añade un servicio a una categoría.
 */
export async function createCategoryService(
  categoryId: number,
  service: string,
  isDefault: boolean,
): Promise<CategoryServiceDto> {
  return invoke<CategoryServiceDto>("category_service_create", { categoryId, service, isDefault });
}

/**
 * Cambia si un servicio se preselecciona por defecto.
 */
export async function setCategoryServiceDefault(id: number, isDefault: boolean): Promise<void> {
  return invoke<void>("category_service_set_default", { id, isDefault });
}

/**
 * Elimina un servicio de categoría.
 */
export async function deleteCategoryService(id: number): Promise<void> {
  return invoke<void>("category_service_delete", { id });
}

/**
 * Lista todos los acabados configurados por categoría.
 */
export async function fetchCategoryFinishes(): Promise<CategoryFinishDto[]> {
  return invoke<CategoryFinishDto[]>("category_finishes_all");
}

/**
 * Añade un acabado a una categoría.
 */
export async function createCategoryFinish(
  categoryId: number,
  finish: string,
  isDefault: boolean,
): Promise<CategoryFinishDto> {
  return invoke<CategoryFinishDto>("category_finish_create", { categoryId, finish, isDefault });
}

/**
 * Cambia si un acabado se preselecciona por defecto.
 */
export async function setCategoryFinishDefault(id: number, isDefault: boolean): Promise<void> {
  return invoke<void>("category_finish_set_default", { id, isDefault });
}

/**
 * Elimina un acabado de categoría.
 */
export async function deleteCategoryFinish(id: number): Promise<void> {
  return invoke<void>("category_finish_delete", { id });
}
