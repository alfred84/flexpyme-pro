import { invoke } from "@tauri-apps/api/core";
import type {
  CreateEmployeePayload,
  CreateWorkBatchPayload,
  DestajoPendingDto,
  EmployeeDto,
  EmployeeExtraRoleDto,
  InvoiceWorkBatchDto,
  PayrollDailyRowDto,
  UpdateEmployeePayload,
  WorkBatchDto,
  WorkCostDto,
} from "@/types/employee";

/**
 * Lists employees; pass `activeOnly` to hide deactivated employees.
 */
export async function fetchEmployees(activeOnly = false): Promise<EmployeeDto[]> {
  return invoke<EmployeeDto[]>("employees_list", { activeOnly });
}

/**
 * Loads a single employee by id.
 */
export async function fetchEmployeeById(id: number): Promise<EmployeeDto> {
  return invoke<EmployeeDto>("employees_get_by_id", { id });
}

/**
 * Creates an employee, returning the new id.
 */
export async function createEmployee(payload: CreateEmployeePayload): Promise<number> {
  return invoke<number>("employees_create", { payload });
}

/**
 * Updates an existing employee.
 */
export async function updateEmployee(payload: UpdateEmployeePayload): Promise<void> {
  return invoke<void>("employees_update", { payload });
}

/**
 * Deactivates an employee (soft delete).
 */
export async function deactivateEmployee(id: number): Promise<void> {
  return invoke<void>("employees_deactivate", { id });
}

/**
 * Loads active cost rows for a work type (to build the batch form).
 */
export async function fetchCostListForWorkType(workTypeId: number): Promise<WorkCostDto[]> {
  return invoke<WorkCostDto[]>("cost_list_for_work_type", { workTypeId });
}

/**
 * Reactiva un empleado dado de baja.
 */
export async function reactivateEmployee(id: number): Promise<void> {
  return invoke("employees_reactivate", { id });
}

/**
 * Creates a work batch and its items; returns the new batch id.
 */
export async function createWorkBatch(payload: CreateWorkBatchPayload): Promise<number> {
  return invoke<number>("work_batch_create", { payload });
}

/**
 * Lists work batches for an employee.
 */
export async function fetchWorkBatches(employeeId: number): Promise<WorkBatchDto[]> {
  return invoke<WorkBatchDto[]>("work_batches_for_employee", { employeeId });
}

/**
 * Lists work batches linked to an invoice.
 */
export async function fetchWorkBatchesForInvoice(invoiceId: number): Promise<InvoiceWorkBatchDto[]> {
  return invoke<InvoiceWorkBatchDto[]>("work_batches_for_invoice", { invoiceId });
}

/**
 * Marks a work batch as paid (registers cash egress with optional denominations).
 *
 * @param payload - Id del lote y datos de caja.
 */
export async function payWorkBatch(payload: {
  batchId: number;
  paymentMethod?: string;
  currency?: string;
  denominationBreakdown?: string | null;
  amountCup?: number;
  amountUsd?: number;
}): Promise<void> {
  return invoke<void>("work_batch_pay", { payload });
}

/** Lote o salario fijo pendiente de pago. */
export interface UnpaidBatchDto {
  id: number;
  employeeId: number;
  employeeName: string;
  workType: string;
  date: string;
  totalCost: number;
  paid: number;
  pending: number;
  /** `true` si es salario fijo diario (no lote de producción). */
  isFixedSalary: boolean;
}

/**
 * Lista lotes pendientes de pago para una fecha (por defecto hoy).
 *
 * @param date - Fecha ISO opcional.
 */
export async function fetchUnpaidBatchesForDate(date?: string): Promise<UnpaidBatchDto[]> {
  return invoke<UnpaidBatchDto[]>("work_batches_unpaid_for_date", { date: date ?? null });
}

/**
 * Empleados con destajo pendiente de definir para una fecha (por defecto hoy).
 *
 * @param date - Fecha ISO opcional.
 */
export async function fetchDestajoPendingForDate(date?: string): Promise<DestajoPendingDto[]> {
  return invoke<DestajoPendingDto[]>("destajo_pending_for_date", { date: date ?? null });
}

/**
 * Define o actualiza el destajo diario de un empleado.
 *
 * @param payload - Empleado, fecha opcional e importe CUP.
 * @returns Id del registro diario.
 */
export async function setDestajoDailySalary(payload: {
  employeeId: number;
  date?: string;
  amountCup: number;
}): Promise<number> {
  return invoke<number>("set_destajo_daily_salary", { payload });
}

/**
 * Paga varios lotes en un solo egreso de caja.
 *
 * @param payload - Ids de lotes y desglose.
 */
export async function payWorkBatchesMany(payload: {
  batchIds: number[];
  dailySalaryIds?: number[];
  paymentMethod?: string;
  currency?: string;
  denominationBreakdown?: string | null;
  amountCup?: number;
  amountUsd?: number;
}): Promise<void> {
  return invoke<void>("work_batches_pay_many", { payload });
}

/**
 * Lists the extra roles assigned to an employee (multi-role).
 */
export async function fetchEmployeeExtraRoles(
  employeeId: number,
): Promise<EmployeeExtraRoleDto[]> {
  return invoke<EmployeeExtraRoleDto[]>("employee_extra_roles_list", { employeeId });
}

/**
 * Adds an extra role to an employee.
 */
export async function addEmployeeExtraRole(employeeId: number, roleId: number): Promise<void> {
  return invoke<void>("employee_extra_role_add", { employeeId, roleId });
}

/**
 * Removes an extra role assignment by its id.
 */
export async function removeEmployeeExtraRole(id: number): Promise<void> {
  return invoke<void>("employee_extra_role_remove", { id });
}

/**
 * Loads the daily payroll for a date (`YYYY-MM-DD`).
 *
 * @param date - Fecha ISO del día a consultar.
 */
export async function fetchPayrollDaily(date: string): Promise<PayrollDailyRowDto[]> {
  return invoke<PayrollDailyRowDto[]>("payroll_daily", { date });
}
