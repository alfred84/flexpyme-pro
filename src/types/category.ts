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
