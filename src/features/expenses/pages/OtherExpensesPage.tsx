import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt, Trash2 } from "lucide-react";
import {
  createOtherExpense,
  deleteOtherExpense,
  fetchOtherExpenses,
  fetchOtherExpensesSummary,
} from "@/db/queries/other-expenses";
import { fetchEmployees } from "@/db/queries/employees";
import { DenominationGrid } from "@/components/cashflow/DenominationGrid";
import {
  emptyDenominationCounts,
  serializeDenominationBreakdown,
  sumDenominationCounts,
} from "@/lib/cash-counts";
import { useAppSettings } from "@/hooks/use-app-settings";
import { formatDate, todayIso } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import {
  OTHER_EXPENSE_TYPES,
  OTHER_EXPENSE_TYPE_LABELS,
  type OtherExpenseType,
} from "@/types/other-expense";

/**
 * Módulo "Otros gastos": registra gastos operativos (almuerzo, transporte,
 * etc.) que generan un egreso en caja, con vistas de total diario y mensual.
 *
 * @returns Página de otros gastos.
 */
export function OtherExpensesPage() {
  const queryClient = useQueryClient();
  const settings = useAppSettings();

  const [date, setDate] = useState(() => todayIso());
  const [concept, setConcept] = useState("");
  const [expenseType, setExpenseType] = useState<OtherExpenseType>("almuerzo");
  const [employeeId, setEmployeeId] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "transferencia">("efectivo");
  const [currency, setCurrency] = useState<"CUP" | "USD">("CUP");
  const [amount, setAmount] = useState("");
  const [cupCounts, setCupCounts] = useState<Record<string, number>>(() =>
    emptyDenominationCounts("CUP"),
  );
  const [usdCounts, setUsdCounts] = useState<Record<string, number>>(() =>
    emptyDenominationCounts("USD"),
  );
  const [error, setError] = useState<string | null>(null);

  const isCash = paymentMethod === "efectivo";

  const expensesQuery = useQuery({
    queryKey: ["other-expenses", "list"],
    queryFn: fetchOtherExpenses,
  });
  const summaryQuery = useQuery({
    queryKey: ["other-expenses", "summary"],
    queryFn: fetchOtherExpensesSummary,
  });
  const employeesQuery = useQuery({
    queryKey: ["employees", "list"],
    queryFn: () => fetchEmployees(true),
  });

  const expenses = expensesQuery.data ?? [];
  const summary = summaryQuery.data;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["other-expenses"] });
    void queryClient.invalidateQueries({ queryKey: ["cashflow"] });
  };

  const createMutation = useMutation({
    mutationFn: createOtherExpense,
    onSuccess: () => {
      setConcept("");
      setAmount("");
      setCupCounts(emptyDenominationCounts("CUP"));
      setUsdCounts(emptyDenominationCounts("USD"));
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteOtherExpense,
    onSuccess: invalidate,
  });

  const handleCountsChange = (next: Record<string, number>) => {
    if (currency === "USD") {
      setUsdCounts(next);
      setAmount(String(sumDenominationCounts(next, "USD")));
    } else {
      setCupCounts(next);
      setAmount(String(sumDenominationCounts(next, "CUP")));
    }
  };

  const monthTotal = useMemo(
    () => expenses.reduce((acc, e) => acc + e.amountCup, 0),
    [expenses],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!concept.trim()) {
      setError("El concepto es obligatorio.");
      return;
    }
    const value = Number(amount);
    if (!value || value <= 0) {
      setError("El importe debe ser mayor que cero.");
      return;
    }

    let amountCup = value;
    let amountUsd = 0;
    if (currency === "USD") {
      const rate = settings.usdExchangeRate || 0;
      if (rate <= 0) {
        setError("Configura la tasa USD → CUP antes de registrar gastos en USD.");
        return;
      }
      amountUsd = value;
      amountCup = value * rate;
    }

    const denominationBreakdown = isCash
      ? serializeDenominationBreakdown(currency === "USD" ? usdCounts : cupCounts, currency)
      : null;

    createMutation.mutate({
      date,
      concept: concept.trim(),
      expenseType,
      employeeId: employeeId === "" ? null : employeeId,
      amountCup,
      amountUsd,
      paymentMethod,
      denominationBreakdown,
    });
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Receipt className="h-6 w-6" /> Otros gastos
        </h1>
      </div>

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

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <form
        className="grid grid-cols-1 gap-4 rounded-lg border border-base-300 bg-base-100 p-4 sm:grid-cols-2 xl:grid-cols-3"
        onSubmit={handleSubmit}
      >
        <label className="form-control">
          <span className="label-text">Fecha</span>
          <input
            type="date"
            className="input input-bordered input-sm"
            value={date}
            onChange={(e) => setDate(e.target.value || todayIso())}
          />
        </label>
        <label className="form-control">
          <span className="label-text">Tipo</span>
          <select
            className="select select-bordered select-sm"
            value={expenseType}
            onChange={(e) => setExpenseType(e.target.value as OtherExpenseType)}
          >
            {OTHER_EXPENSE_TYPES.map((t) => (
              <option key={t} value={t}>
                {OTHER_EXPENSE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="form-control">
          <span className="label-text">Empleado (opcional)</span>
          <select
            className="select select-bordered select-sm"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">—</option>
            {(employeesQuery.data ?? []).map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-control sm:col-span-2 xl:col-span-3">
          <span className="label-text">Concepto</span>
          <input
            className="input input-bordered input-sm"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="Ej.: Almuerzo del equipo"
          />
        </label>
        <label className="form-control">
          <span className="label-text">Forma de pago</span>
          <select
            className="select select-bordered select-sm"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as "efectivo" | "transferencia")}
          >
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
          </select>
        </label>
        <label className="form-control">
          <span className="label-text">Moneda</span>
          <select
            className="select select-bordered select-sm"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "CUP" | "USD")}
          >
            <option value="CUP">CUP</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label className="form-control">
          <span className="label-text">Importe ({currency})</span>
          <input
            type="number"
            className="input input-bordered input-sm"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        {isCash && (
          <div className="rounded-lg border border-base-300 p-3 sm:col-span-2 xl:col-span-3">
            <DenominationGrid
              currency={currency}
              counts={currency === "USD" ? usdCounts : cupCounts}
              onChange={handleCountsChange}
              label="Desglose de efectivo (opcional, actualiza el importe):"
            />
          </div>
        )}
        <div className="sm:col-span-2 xl:col-span-3">
          <button type="submit" className="btn btn-primary btn-sm" disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              "Registrar gasto"
            )}
          </button>
        </div>
      </form>

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
                <td className="capitalize">
                  {OTHER_EXPENSE_TYPE_LABELS[exp.expenseType as OtherExpenseType] ?? exp.expenseType}
                </td>
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
            {expenses.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-base-content/60">
                  Sin gastos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
