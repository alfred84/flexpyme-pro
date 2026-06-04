import { invoke } from "@tauri-apps/api/core";

export interface EmployeeRoleDto {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface CreateRolePayload {
  name: string;
  description?: string | null;
}

export interface UpdateRolePayload {
  name: string;
  description?: string | null;
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
 * @param payload - Nombre y descripción.
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
export async function updateEmployeeRole(id: number, payload: UpdateRolePayload): Promise<EmployeeRoleDto> {
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
