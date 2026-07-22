/**
 * Acabado del catálogo global (Configuración → Acabados).
 */
export interface FinishDto {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  isSystem: boolean;
}

/**
 * Payload para actualizar un acabado.
 */
export interface UpdateFinishPayload {
  name: string;
  description?: string | null;
}
