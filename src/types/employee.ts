/**
 * Empleado del taller.
 */
export interface EmployeeDto {
  id: number;
  name: string;
  roleId: number | null;
  role: string | null;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  /** Nombres de roles adicionales (listado/detalle). */
  extraRoles: string[];
  /** Ids de roles adicionales (formulario de edición). */
  extraRoleIds: number[];
}

/**
 * Payload de creación de empleado.
 */
export interface CreateEmployeePayload {
  name: string;
  roleId: number | null;
  phone: string | null;
  notes: string | null;
  extraRoleIds: number[];
}

/**
 * Payload de actualización de empleado.
 */
export interface UpdateEmployeePayload extends CreateEmployeePayload {
  id: number;
}

/**
 * Rol adicional asignado a un empleado (multi-rol).
 */
export interface EmployeeExtraRoleDto {
  id: number;
  roleId: number;
  role: string;
}

/**
 * Fila de nómina diaria agregada por empleado/día.
 */
export interface PayrollDailyRowDto {
  employeeId: number;
  employeeName: string;
  date: string;
  totalCost: number;
  paid: number;
  pending: number;
}

/**
 * Tipos de trabajo retribuibles a empleados.
 */
export const WORK_TYPES = ["laminado", "enmarcado", "respaldo", "impresion"] as const;
export type WorkType = (typeof WORK_TYPES)[number];

/**
 * Etiqueta en español por tipo de trabajo.
 */
export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  laminado: "Laminado",
  enmarcado: "Enmarcado completo",
  respaldo: "Solo Respaldo",
  impresion: "Impresión",
};

/**
 * Costo por formato para un tipo de trabajo (form de lote).
 */
export interface WorkCostDto {
  formatId: number;
  formatLabel: string;
  unitCost: number;
}

/**
 * Línea de un lote de trabajo.
 */
export interface WorkBatchItemPayload {
  clientId: number;
  formatId: number | null;
  category: string;
  quantity: number;
  unitCost: number;
}

/**
 * Payload de creación de lote de trabajo.
 */
export interface CreateWorkBatchPayload {
  employeeId: number;
  workTypeId: number;
  date: string;
  notes: string | null;
  payNow: boolean;
  invoiceId?: number | null;
  items: WorkBatchItemPayload[];
}

/**
 * Lote de trabajo vinculado a un pedido.
 */
export interface InvoiceWorkBatchDto {
  id: number;
  employeeName: string;
  workType: string;
  date: string;
  totalCost: number;
  paid: number;
  status: string;
}

/**
 * Lote de trabajo (historial del empleado).
 */
export interface WorkBatchDto {
  id: number;
  workType: string;
  date: string;
  totalCost: number;
  paid: number;
  status: string;
}
