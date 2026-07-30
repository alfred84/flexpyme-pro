import { invoke } from "@tauri-apps/api/core";

export interface EmployeeRoleDto {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  /** Tipos de trabajo que este rol puede realizar. */
  workTypeIds: number[];
}

export interface CreateRolePayload {
  name: string;
  description?: string | null;
  workTypeIds?: number[];
}

export interface UpdateRolePayload {
  name: string;
  description?: string | null;
  workTypeIds?: number[];
}

/** Empleado elegible para un tipo de trabajo. */
export interface EmployeeForWorkTypeDto {
  id: number;
  name: string;
  roleId: number | null;
  role: string | null;
}

/**
 * Lista roles de empleados.
 *
 * @param activeOnly - Si true, solo roles activos.
 * @returns Roles del catálogo.
 */
export async function fetchEmployeeRoles(activeOnly = false): Promise<EmployeeRoleDto[]> {
  return invoke<EmployeeRoleDto[]>("get_employee_roles", { activeOnly });
}

/**
 * Crea un rol de empleado.
 *
 * @param payload - Nombre, descripción y tipos de trabajo.
 * @returns Rol creado.
 */
export async function createEmployeeRole(payload: CreateRolePayload): Promise<EmployeeRoleDto> {
  return invoke<EmployeeRoleDto>("create_employee_role", { payload });
}

/**
 * Actualiza un rol existente.
 *
 * @param id - Id del rol.
 * @param payload - Datos a guardar.
 * @returns Rol actualizado.
 */
export async function updateEmployeeRole(
  id: number,
  payload: UpdateRolePayload,
): Promise<EmployeeRoleDto> {
  return invoke<EmployeeRoleDto>("update_employee_role", { id, payload });
}

/**
 * Desactiva un rol sin empleados activos asignados.
 *
 * @param id - Id del rol.
 */
export async function deactivateEmployeeRole(id: number): Promise<void> {
  return invoke("deactivate_employee_role", { id });
}

/**
 * Reactiva un rol desactivado.
 *
 * @param id - Id del rol.
 */
export async function reactivateEmployeeRole(id: number): Promise<EmployeeRoleDto> {
  return invoke<EmployeeRoleDto>("reactivate_employee_role", { id });
}

/**
 * Empleados activos cuyo rol primario o secundario incluye el tipo de trabajo.
 *
 * @param workTypeId - Id del tipo de trabajo.
 */
export async function fetchEmployeesForWorkType(
  workTypeId: number,
): Promise<EmployeeForWorkTypeDto[]> {
  return invoke<EmployeeForWorkTypeDto[]>("employees_for_work_type", { workTypeId });
}

/**
 * Empleados activos elegibles por nombre/código del tipo de trabajo.
 *
 * @param workTypeName - Nombre o código del tipo (p.ej. «Laminado»).
 */
export async function fetchEmployeesForWorkTypeName(
  workTypeName: string,
): Promise<EmployeeForWorkTypeDto[]> {
  return invoke<EmployeeForWorkTypeDto[]>("employees_for_work_type_name", { workTypeName });
}
