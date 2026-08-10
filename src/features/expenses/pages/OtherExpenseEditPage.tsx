import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Receipt } from "lucide-react";
import { fetchOtherExpenseById, updateOtherExpense } from "@/db/queries/other-expenses";
import { fetchExpenseTypes } from "@/db/queries/expense-types";
import { fetchEmployees } from "@/db/queries/employees";
import { DenominationGrid } from "@/components/cashflow/DenominationGrid";
import {
  emptyDenominationCounts,
  parseDenominationBreakdown,
  serializeDenominationBreakdown,
  sumDenominationCounts,
} from "@/lib/cash-counts";
import { todayIso } from "@/lib/format-date";
import { pushFlashMessage } from "@/lib/flash-message";
import type { ExpenseTypeDto, OtherExpenseDto } from "@/types/other-expense";
import type { DenominationCurrency } from "@/types/cashier";

interface InitialFormState {
  date: string;
  concept: string;
  expenseType: string;
  employeeId: number | "";
  paymentMethod: "efectivo" | "transferencia";
  currency: DenominationCurrency;
  amount: string;
  cupCounts: Record<string, number>;
  usdCounts: Record<string, number>;
  notes: string;
}

/**
 * Deriva el estado inicial del formulario a partir del gasto cargado.
 *
 * @param expense - Gasto a editar.
 * @returns Valores iniciales del formulario.
 */
function buildInitialState(expense: OtherExpenseDto): InitialFormState {
  const parsed = parseDenominationBreakdown(expense.denominationBreakdown);
  let currency: DenominationCurrency = "CUP";
  let amount = String(expense.amountCup);
  let cupCounts = emptyDenominationCounts("CUP");
  let usdCounts = emptyDenominationCounts("USD");

  if (parsed) {
    currency = parsed.currency;
    if (parsed.currency === "USD") {
      usdCounts = parsed.counts;
      const fromCounts = sumDenominationCounts(parsed.counts, "USD");
      amount = String(fromCounts > 0 ? fromCounts : expense.amountUsd);
    } else {
      cupCounts = parsed.counts;
      const fromCounts = sumDenominationCounts(parsed.counts, "CUP");
      amount = String(fromCounts > 0 ? fromCounts : expense.amountCup);
    }
  } else if (expense.amountUsd > 0.001) {
    currency = "USD";
    amount = String(expense.amountUsd);
  }

  return {
    date: expense.date.slice(0, 10),
    concept: expense.concept,
    expenseType: expense.expenseType,
    employeeId: expense.employeeId ?? "",
    paymentMethod: expense.paymentMethod === "transferencia" ? "transferencia" : "efectivo",
    currency,
    amount,
    cupCounts,
    usdCounts,
    notes: expense.notes ?? "",
  };
}

interface OtherExpenseEditFormProps {
  expense: OtherExpenseDto;
  activeTypes: ExpenseTypeDto[];
}

/**
 * Formulario de edición hidratado con el gasto (montado solo cuando hay datos).
 *
 * @param props - Gasto y tipos activos.
 * @returns Formulario controlado.
 */
function OtherExpenseEditForm(props: OtherExpenseEditFormProps) {
  const { expense, activeTypes } = props;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initial = buildInitialState(expense);

  const [date, setDate] = useState(initial.date);
  const [concept, setConcept] = useState(initial.concept);
  const [expenseType, setExpenseType] = useState(initial.expenseType);
  const [employeeId, setEmployeeId] = useState<number | "">(initial.employeeId);
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "transferencia">(
    initial.paymentMethod,
  );
  const [currency, setCurrency] = useState<DenominationCurrency>(initial.currency);
  const [amount, setAmount] = useState(initial.amount);
  const [cupCounts, setCupCounts] = useState(initial.cupCounts);
  const [usdCounts, setUsdCounts] = useState(initial.usdCounts);
  const [notes, setNotes] = useState(initial.notes);
  const [error, setError] = useState<string | null>(null);

  const isCash = paymentMethod === "efectivo";
  const employeesQuery = useQuery({
    queryKey: ["employees", "list"],
    queryFn: () => fetchEmployees(true),
  });

  const typeOptions = [...activeTypes];
  if (expenseType && !typeOptions.some((t) => t.name === expenseType)) {
    typeOptions.unshift({
      id: -1,
      name: expenseType,
      isActive: false,
      sortOrder: 0,
    });
  }

  const selectedType = typeOptions.some((t) => t.name === expenseType)
    ? expenseType
    : (typeOptions[0]?.name ?? expenseType);

  const updateMutation = useMutation({
    mutationFn: updateOtherExpense,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["other-expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["cashflow"] });
      pushFlashMessage({ kind: "success", text: "Gasto actualizado correctamente." });
      await navigate({
        to: "/otros-gastos/$expenseId",
        params: { expenseId: String(expense.id) },
      });
    },
    onError: (err: Error) => setError(err.message),
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const tipo = selectedType.trim();
    if (!tipo) {
      setError("El tipo de gasto es obligatorio.");
      return;
    }
    if (!concept.trim()) {
      setError("El concepto es obligatorio.");
      return;
    }
    const value = Number(amount);
    if (!value || value <= 0) {
      setError("El importe debe ser mayor que cero.");
      return;
    }

    // Cajón físico: gasto USD no escribe equivalente en amount_cup.
    let amountCup = 0;
    let amountUsd = 0;
    if (currency === "USD") {
      amountUsd = value;
    } else {
      amountCup = value;
    }

    const denominationBreakdown = isCash
      ? serializeDenominationBreakdown(currency === "USD" ? usdCounts : cupCounts, currency)
      : null;

    updateMutation.mutate({
      id: expense.id,
      date,
      concept: concept.trim(),
      expenseType: tipo,
      employeeId: employeeId === "" ? null : employeeId,
      amountCup,
      amountUsd,
      paymentMethod,
      denominationBreakdown,
      notes: notes.trim() || null,
    });
  };

  return (
    <>
      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <form
        className="mx-auto grid max-w-2xl grid-cols-1 gap-4 rounded-lg border border-base-300 bg-base-100 p-4 sm:grid-cols-2"
        onSubmit={handleSubmit}
      >
        <label className="form-control">
          <span className="label-text">Fecha</span>
          <input
            type="date"
            className="input input-bordered"
            value={date}
            onChange={(e) => setDate(e.target.value || todayIso())}
          />
        </label>
        <label className="form-control">
          <span className="label-text">Tipo</span>
          <select
            className="select select-bordered"
            value={selectedType}
            onChange={(e) => setExpenseType(e.target.value)}
          >
            {typeOptions.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
                {!t.isActive ? " (inactivo)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="form-control sm:col-span-2">
          <span className="label-text">Concepto</span>
          <input
            className="input input-bordered"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
          />
        </label>
        <label className="form-control">
          <span className="label-text">Empleado (opcional)</span>
          <select
            className="select select-bordered"
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
        <label className="form-control">
          <span className="label-text">Forma de pago</span>
          <select
            className="select select-bordered"
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
            className="select select-bordered"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as DenominationCurrency)}
          >
            <option value="CUP">CUP</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label className="form-control">
          <span className="label-text">Importe ({currency})</span>
          <input
            type="number"
            className="input input-bordered"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={0}
            step="any"
          />
        </label>
        <label className="form-control sm:col-span-2">
          <span className="label-text">Notas (opcional)</span>
          <textarea
            className="textarea textarea-bordered"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        {isCash && (
          <div className="rounded-lg border border-base-300 p-3 sm:col-span-2">
            <DenominationGrid
              currency={currency}
              counts={currency === "USD" ? usdCounts : cupCounts}
              onChange={handleCountsChange}
              label="Desglose de efectivo (opcional, actualiza el importe):"
            />
          </div>
        )}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              "Guardar cambios"
            )}
          </button>
          <Link
            to="/otros-gastos/$expenseId"
            params={{ expenseId: String(expense.id) }}
            className="btn btn-ghost"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </>
  );
}

/**
 * Edición de un gasto operativo; sincroniza el egreso en caja al guardar.
 *
 * @returns Página de edición del gasto.
 */
export function OtherExpenseEditPage() {
  const params = useParams({ strict: false }) as { expenseId?: string };
  const expenseId = Number(params.expenseId);

  const expenseQuery = useQuery({
    queryKey: ["other-expenses", "detail", expenseId],
    queryFn: () => fetchOtherExpenseById(expenseId),
    enabled: Number.isFinite(expenseId) && expenseId > 0,
  });
  const typesQuery = useQuery({
    queryKey: ["expense-types", "active"],
    queryFn: () => fetchExpenseTypes(true),
  });

  if (!Number.isFinite(expenseId) || expenseId <= 0) {
    return (
      <div className="alert alert-warning">
        <span>Identificador de gasto no válido.</span>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Receipt className="h-6 w-6" /> Editar gasto
        </h1>
        <Link
          to="/otros-gastos/$expenseId"
          params={{ expenseId: String(expenseId) }}
          className="btn btn-ghost btn-sm gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Cancelar
        </Link>
      </div>

      {expenseQuery.isLoading && <p className="text-sm text-base-content/60">Cargando…</p>}
      {expenseQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudo cargar el gasto para editar.</span>
        </div>
      )}

      {expenseQuery.data && (
        <OtherExpenseEditForm
          key={expenseQuery.data.id}
          expense={expenseQuery.data}
          activeTypes={typesQuery.data ?? []}
        />
      )}
    </section>
  );
}
