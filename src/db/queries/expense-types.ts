import { invoke } from "@tauri-apps/api/core";
import type {
  CreateExpenseTypePayload,
  ExpenseTypeDto,
  UpdateExpenseTypePayload,
} from "@/types/other-expense";

/**
 * Lista tipos de gasto del catálogo.
 *
 * @param activeOnly - Si true, solo tipos activos (para el select del formulario).
 * @returns Tipos ordenados por prioridad y nombre.
 */
export async function fetchExpenseTypes(activeOnly = false): Promise<ExpenseTypeDto[]> {
  return invoke<ExpenseTypeDto[]>("expense_types_list", { activeOnly });
}

/**
 * Crea un tipo de gasto activo.
 *
 * @param payload - Nombre del tipo.
 * @returns Tipo creado.
 */
export async function createExpenseType(
  payload: CreateExpenseTypePayload,
): Promise<ExpenseTypeDto> {
  return invoke<ExpenseTypeDto>("expense_type_create", { payload });
}

/**
 * Renombra un tipo de gasto existente.
 *
 * @param id - Identificador del tipo.
 * @param payload - Nuevo nombre.
 * @returns Tipo actualizado.
 */
export async function updateExpenseType(
  id: number,
  payload: UpdateExpenseTypePayload,
): Promise<ExpenseTypeDto> {
  return invoke<ExpenseTypeDto>("expense_type_update", { id, payload });
}

/**
 * Desactiva un tipo (deja de aparecer en el select de nuevos gastos).
 *
 * @param id - Identificador del tipo.
 */
export async function deactivateExpenseType(id: number): Promise<void> {
  return invoke("expense_type_deactivate", { id });
}

/**
 * Reactiva un tipo de gasto desactivado.
 *
 * @param id - Identificador del tipo.
 * @returns Tipo reactivado.
 */
export async function reactivateExpenseType(id: number): Promise<ExpenseTypeDto> {
  return invoke<ExpenseTypeDto>("expense_type_reactivate", { id });
}
