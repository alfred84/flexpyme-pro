/**
 * Tipos de otros gastos operativos.
 */
export const OTHER_EXPENSE_TYPES = ["almuerzo", "transporte", "salario", "otros"] as const;
export type OtherExpenseType = (typeof OTHER_EXPENSE_TYPES)[number];

/**
 * Etiqueta en español por tipo de gasto.
 */
export const OTHER_EXPENSE_TYPE_LABELS: Record<OtherExpenseType, string> = {
  almuerzo: "Almuerzo",
  transporte: "Transporte",
  salario: "Salario",
  otros: "Otros",
};

/**
 * Otro gasto operativo (afecta la caja como egreso).
 */
export interface OtherExpenseDto {
  id: number;
  date: string;
  concept: string;
  expenseType: string;
  employeeId: number | null;
  employeeName: string | null;
  amountCup: number;
  amountUsd: number;
  paymentMethod: string;
  notes: string | null;
}

/**
 * Totales netos de otros gastos (día y mes en curso).
 */
export interface OtherExpenseSummaryDto {
  todayCup: number;
  monthCup: number;
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
