/**
 * Unidad de medida del catálogo.
 */
export interface UnitDto {
  id: number;
  code: string;
  name: string;
  abbreviation: string;
  unitType: string;
  isActive: boolean;
  isSystem: boolean;
}

/** Tipos de unidad admitidos. */
export type UnitType = "cantidad" | "peso" | "volumen" | "longitud" | "area";

/**
 * Payload para crear unidad personalizada.
 */
export interface CreateUnitPayload {
  name: string;
  abbreviation: string;
  unitType: UnitType;
}

/**
 * Payload para actualizar unidad no sistema.
 */
export interface UpdateUnitPayload {
  name: string;
  abbreviation: string;
}
