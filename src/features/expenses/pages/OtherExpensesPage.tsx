import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, Receipt, Settings2, Trash2 } from "lucide-react";
import {
  deleteOtherExpense,
  fetchOtherExpenses,
  fetchOtherExpensesSummary,
} from "@/db/queries/other-expenses";
import { ExpenseTypesConfigModal } from "@/features/expenses/components/ExpenseTypesConfigModal";
import { formatDate, todayIso } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import { popFlashMessage, type FlashMessage } from "@/lib/flash-message";
import type { OtherExpenseDto } from "@/types/other-expense";

/** Periodo rápido del listado de Otros gastos. */
type ExpensePeriodFilter = "hoy" | "mes" | "todos";

const PERIOD_OPTIONS: { id: ExpensePeriodFilter; label: string }[] = [
  { id: "hoy", label: "Día actual" },
  { id: "mes", label: "Mes actual" },
  { id: "todos", label: "Todos" },
];

/**
 * Extrae `YYYY-MM-DD` de una fecha almacenada (con o sin hora).
 *
 * @param value - Fecha ISO del gasto.
 * @returns Solo la parte de fecha o cadena vacía.
 */
function expenseDateOnly(value: string): string {
  return value.trim().slice(0, 10);
}

/**
 * Filtra gastos según el periodo seleccionado (calendario local).
 *
 * @param expenses - Listado completo.
 * @param period - Periodo activo.
 * @returns Gastos del periodo.
 */
function filterExpensesByPeriod(
  expenses: OtherExpenseDto[],
  period: ExpensePeriodFilter,
): OtherExpenseDto[] {
  if (period === "todos") {
    return expenses;
  }
  const today = todayIso();
  if (period === "hoy") {
    return expenses.filter((e) => expenseDateOnly(e.date) === today);
  }
  const monthPrefix = today.slice(0, 7);
  return expenses.filter((e) => expenseDateOnly(e.date).startsWith(monthPrefix));
}

/**
 * Etiqueta del KPI de total según el periodo del listado.
 *
 * @param period - Periodo activo.
 * @returns Texto del KPI.
 */
function periodTotalLabel(period: ExpensePeriodFilter): string {
  switch (period) {
    case "hoy":
      return "Total del día (listado)";
    case "mes":
      return "Total del mes (listado)";
    default:
      return "Total listado";
  }
}

/**
 * Listado y resumen de Otros gastos. Alta en `/otros-gastos/nuevo`;
 * detalle/edición en rutas anidadas.
 *
 * @returns Página de otros gastos.
 */
export function OtherExpensesPage() {
  const queryClient = useQueryClient();
  const [showTypesModal, setShowTypesModal] = useState(false);
  const [period, setPeriod] = useState<ExpensePeriodFilter>("hoy");
  const [flash] = useState<FlashMessage | null>(() => popFlashMessage());

  const expensesQuery = useQuery({
    queryKey: ["other-expenses", "list"],
    queryFn: fetchOtherExpenses,
  });
  const summaryQuery = useQuery({
    queryKey: ["other-expenses", "summary"],
    queryFn: fetchOtherExpensesSummary,
  });

  const expenses = expensesQuery.data ?? [];
  const summary = summaryQuery.data;

  const filteredExpenses = useMemo(
    () => filterExpensesByPeriod(expenses, period),
    [expenses, period],
  );
  const periodTotal = filteredExpenses.reduce((acc, e) => acc + e.amountCup, 0);

  const deleteMutation = useMutation({
    mutationFn: deleteOtherExpense,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["other-expenses"] });
      void queryClient.invalidateQueries({ queryKey: ["cashflow"] });
    },
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Receipt className="h-6 w-6" /> Otros gastos
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm gap-1"
            onClick={() => setShowTypesModal(true)}
          >
            <Settings2 className="h-4 w-4" />
            Configurar tipos de gasto
          </button>
          <Link to="/otros-gastos/nuevo" className="btn btn-primary btn-sm gap-1">
            <Plus className="h-4 w-4" />
            Registrar gasto
          </Link>
        </div>
      </div>

      {flash && (
        <div className={flash.kind === "success" ? "alert alert-success" : "alert alert-info"}>
          <span>{flash.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <p className="text-xs uppercase text-base-content/60">Gasto de hoy</p>
            <p className="text-2xl font-semibold text-error">
              {formatMoney(summary?.todayCup ?? 0)}
            </p>
          </div>
        </div>
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <p className="text-xs uppercase text-base-content/60">Gasto del mes</p>
            <p className="text-2xl font-semibold text-error">
              {formatMoney(summary?.monthCup ?? 0)}
            </p>
          </div>
        </div>
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <p className="text-xs uppercase text-base-content/60">{periodTotalLabel(period)}</p>
            <p className="text-2xl font-semibold">{formatMoney(periodTotal)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Periodo del listado</p>
          <p className="text-xs text-base-content/60">
            Filtra la tabla de forma rápida. Por defecto: día actual.
          </p>
        </div>
        <div className="join" role="group" aria-label="Filtrar gastos por periodo">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`btn btn-sm join-item ${period === opt.id ? "btn-primary" : "btn-ghost"}`}
              aria-pressed={period === opt.id}
              onClick={() => setPeriod(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {expensesQuery.isLoading && (
        <p className="text-sm text-base-content/60">Cargando gastos…</p>
      )}
      {expensesQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudieron cargar los gastos.</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Concepto</th>
              <th>Tipo</th>
              <th>Empleado</th>
              <th>Método</th>
              <th className="text-right">Importe</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.map((exp) => (
              <tr key={exp.id}>
                <td className="text-xs">{formatDate(exp.date)}</td>
                <td>
                  <Link
                    to="/otros-gastos/$expenseId"
                    params={{ expenseId: String(exp.id) }}
                    className="link link-hover font-medium"
                  >
                    {exp.concept}
                  </Link>
                </td>
                <td>{exp.expenseType}</td>
                <td>{exp.employeeName ?? "—"}</td>
                <td className="capitalize">{exp.paymentMethod}</td>
                <td className="text-right font-mono">{formatMoney(exp.amountCup)}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    <Link
                      to="/otros-gastos/$expenseId"
                      params={{ expenseId: String(exp.id) }}
                      className="btn btn-xs btn-outline"
                    >
                      Ver
                    </Link>
                    <Link
                      to="/otros-gastos/$expenseId/editar"
                      params={{ expenseId: String(exp.id) }}
                      className="btn btn-xs btn-ghost"
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      title="Eliminar gasto"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm("¿Eliminar este gasto y su egreso en caja?")) {
                          deleteMutation.mutate(exp.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {expensesQuery.isSuccess && filteredExpenses.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-base-content/60">
                  {expenses.length === 0 ? (
                    <>
                      <p>Sin gastos registrados.</p>
                      <Link to="/otros-gastos/nuevo" className="btn btn-link btn-sm mt-2">
                        Registrar el primero
                      </Link>
                    </>
                  ) : (
                    <>
                      <p>No hay gastos en este periodo.</p>
                      <button
                        type="button"
                        className="btn btn-link btn-sm mt-2"
                        onClick={() => setPeriod("todos")}
                      >
                        Ver todos
                      </button>
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showTypesModal && (
        <ExpenseTypesConfigModal onClose={() => setShowTypesModal(false)} />
      )}
    </section>
  );
}
