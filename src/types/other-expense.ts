/**
 * Tipo de gasto configurable del módulo Otros gastos.
 */
export interface ExpenseTypeDto {
  id: number;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Payload para crear un tipo de gasto.
 */
export interface CreateExpenseTypePayload {
  name: string;
}

/**
 * Payload para renombrar un tipo de gasto.
 */
export interface UpdateExpenseTypePayload {
  name: string;
}

/**
 * Otro gasto operativo (afecta la caja como egreso).
 */
export interface OtherExpenseDto {
  id: number;
  date: string;
  concept: string;
  /** Snapshot del nombre del tipo al registrar. */
  expenseType: string;
  employeeId: number | null;
  employeeName: string | null;
  amountCup: number;
  amountUsd: number;
  paymentMethod: string;
  denominationBreakdown: string | null;
  notes: string | null;
  cashTransactionId: number | null;
  createdAt: string;
}

/**
 * Totales netos de otros gastos (día y mes en curso, por moneda física).
 */
export interface OtherExpenseSummaryDto {
  todayCup: number;
  monthCup: number;
  todayUsd: number;
  monthUsd: number;
}

/**
 * Payload de registro de otro gasto.
 */
export interface CreateOtherExpensePayload {
  date: string;
  concept: string;
  expenseType: string;
  employeeId?: number | null;
  amountCup: number;
  amountUsd?: number | null;
  paymentMethod: string;
  denominationBreakdown?: string | null;
  notes?: string | null;
}

/**
 * Payload de actualización de otro gasto.
 */
export interface UpdateOtherExpensePayload extends CreateOtherExpensePayload {
  id: number;
}
