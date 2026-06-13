import { invoke } from "@tauri-apps/api/core";
import type { CreateUnitPayload, UnitDto, UnitType, UpdateUnitPayload } from "@/types/unit";

/**
 * Lista unidades de medida.
 */
export async function fetchUnits(activeOnly: boolean, unitType?: UnitType | null): Promise<UnitDto[]> {
  return invoke<UnitDto[]>("get_units", { activeOnly, unitType: unitType ?? null });
}

/**
 * Crea una unidad personalizada.
 */
export async function createUnit(payload: CreateUnitPayload): Promise<UnitDto> {
  return invoke<UnitDto>("create_unit", { data: payload });
}

/**
 * Actualiza una unidad no sistema.
 */
export async function updateUnit(id: number, data: UpdateUnitPayload): Promise<UnitDto> {
  return invoke<UnitDto>("update_unit", { id, data });
}

/**
 * Desactiva una unidad personalizada.
 */
export async function deactivateUnit(id: number): Promise<void> {
  return invoke<void>("deactivate_unit", { id });
}
