import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, Receipt, Settings2, Trash2 } from "lucide-react";
import {
  deleteOtherExpense,
  fetchOtherExpenses,
  fetchOtherExpensesSummary,
} from "@/db/queries/other-expenses";
import { ExpenseTypesConfigModal } from "@/features/expenses/components/ExpenseTypesConfigModal";
import { formatDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import { popFlashMessage, type FlashMessage } from "@/lib/flash-message";

/**
 * Listado y resumen de Otros gastos. El alta se hace en `/otros-gastos/nuevo`.
 *
 * @returns Página de otros gastos.
 */
export function OtherExpensesPage() {
  const queryClient = useQueryClient();
  const [showTypesModal, setShowTypesModal] = useState(false);
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
  const monthTotal = expenses.reduce((acc, e) => acc + e.amountCup, 0);

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
            <p className="text-xs uppercase text-base-content/60">Total listado</p>
            <p className="text-2xl font-semibold">{formatMoney(monthTotal)}</p>
          </div>
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp) => (
              <tr key={exp.id}>
                <td className="text-xs">{formatDate(exp.date)}</td>
                <td>{exp.concept}</td>
                <td>{exp.expenseType}</td>
                <td>{exp.employeeName ?? "—"}</td>
                <td className="capitalize">{exp.paymentMethod}</td>
                <td className="text-right font-mono">{formatMoney(exp.amountCup)}</td>
                <td className="text-right">
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
                </td>
              </tr>
            ))}
            {expensesQuery.isSuccess && expenses.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-base-content/60">
                  <p>Sin gastos registrados.</p>
                  <Link to="/otros-gastos/nuevo" className="btn btn-link btn-sm mt-2">
                    Registrar el primero
                  </Link>
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
