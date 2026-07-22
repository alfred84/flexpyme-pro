/**
 * Categoría de producto del catálogo.
 */
export interface ProductCategoryDto {
  id: number;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
}

/**
 * Payload para crear categoría personalizada.
 */
export interface CreateCategoryPayload {
  name: string;
  code: string;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number;
}

/**
 * Payload para actualizar categoría no sistema.
 */
export interface UpdateCategoryPayload {
  name: string;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number;
}

/**
 * Servicio/área configurado para una categoría (preseleccionable en pedidos).
 */
export interface CategoryServiceDto {
  id: number;
  categoryId: number;
  service: string;
  isDefault: boolean;
  sortOrder: number;
}

/**
 * Acabado configurado para una categoría (opcional).
 */
export interface CategoryFinishDto {
  id: number;
  categoryId: number;
  finish: string;
  isDefault: boolean;
  sortOrder: number;
}

/**
 * Tipo de trabajo vinculado a una categoría.
 */
export interface CategoryWorkTypeDto {
  id: number;
  categoryId: number;
  workTypeId: number;
  workTypeName: string;
  workTypeActive: boolean;
}

/**
 * Formato vinculado a una categoría.
 */
export interface CategoryFormatDto {
  id: number;
  categoryId: number;
  formatId: number;
  formatLabel: string;
  formatActive: boolean;
}
