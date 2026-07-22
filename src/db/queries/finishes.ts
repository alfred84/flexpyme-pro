import { invoke } from "@tauri-apps/api/core";
import type { FinishDto, UpdateFinishPayload } from "@/types/finish";

/**
 * Lista acabados del catálogo; `activeOnly` oculta los desactivados.
 */
export async function fetchFinishes(activeOnly = false): Promise<FinishDto[]> {
  return invoke<FinishDto[]>("get_finishes", { activeOnly });
}

/**
 * Crea un acabado personalizado.
 */
export async function createFinish(
  name: string,
  description?: string | null,
): Promise<FinishDto> {
  return invoke<FinishDto>("create_finish", { name, description: description ?? null });
}

/**
 * Actualiza nombre y descripción de un acabado.
 */
export async function updateFinish(id: number, data: UpdateFinishPayload): Promise<FinishDto> {
  return invoke<FinishDto>("update_finish", { id, data });
}

/**
 * Desactiva un acabado (deja de ofrecerse en categorías y pedidos nuevos).
 */
export async function deactivateFinish(id: number): Promise<void> {
  return invoke<void>("deactivate_finish", { id });
}

/**
 * Reactiva un acabado desactivado.
 */
export async function reactivateFinish(id: number): Promise<FinishDto> {
  return invoke<FinishDto>("reactivate_finish", { id });
}
