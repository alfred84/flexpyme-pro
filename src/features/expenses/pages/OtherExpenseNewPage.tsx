import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Receipt } from "lucide-react";
import { createOtherExpense } from "@/db/queries/other-expenses";
import { fetchExpenseTypes } from "@/db/queries/expense-types";
import { fetchEmployees } from "@/db/queries/employees";
import { DenominationGrid } from "@/components/cashflow/DenominationGrid";
import {
  emptyDenominationCounts,
  serializeDenominationBreakdown,
  sumDenominationCounts,
} from "@/lib/cash-counts";
import { useAppSettings } from "@/hooks/use-app-settings";
import { todayIso } from "@/lib/format-date";
import { pushFlashMessage } from "@/lib/flash-message";

/**
 * Pantalla de alta de un gasto operativo (Otros gastos).
 * Al guardar, registra el egreso en caja y vuelve al listado.
 *
 * @returns Página de registro de gasto.
 */
export function OtherExpenseNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const settings = useAppSettings();

  const [date, setDate] = useState(() => todayIso());
  const [concept, setConcept] = useState("");
  const [expenseType, setExpenseType] = useState("");
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

  const employeesQuery = useQuery({
    queryKey: ["employees", "list"],
    queryFn: () => fetchEmployees(true),
  });
  const typesQuery = useQuery({
    queryKey: ["expense-types", "active"],
    queryFn: () => fetchExpenseTypes(true),
  });

  const activeTypes = typesQuery.data ?? [];
  const selectedType = activeTypes.some((t) => t.name === expenseType)
    ? expenseType
    : (activeTypes[0]?.name ?? "");

  const createMutation = useMutation({
    mutationFn: createOtherExpense,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["other-expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["cashflow"] });
      pushFlashMessage({ kind: "success", text: "Gasto registrado correctamente." });
      await navigate({ to: "/otros-gastos" });
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
    if (!selectedType.trim()) {
      setError("Configura al menos un tipo de gasto activo antes de registrar.");
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
      expenseType: selectedType,
      employeeId: employeeId === "" ? null : employeeId,
      amountCup,
      amountUsd,
      paymentMethod,
      denominationBreakdown,
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Receipt className="h-6 w-6" /> Registrar gasto
        </h1>
        <Link to="/otros-gastos" className="btn btn-ghost btn-sm gap-1">
          <ArrowLeft className="h-4 w-4" />
          Cancelar
        </Link>
      </div>

      <p className="text-sm text-base-content/70">
        El gasto se registrará como egreso en el flujo de caja.
      </p>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {typesQuery.isSuccess && activeTypes.length === 0 && (
        <div className="alert alert-warning">
          <span>
            No hay tipos de gasto activos. Vuelve al listado y usa «Configurar tipos de gasto»
            para crear al menos uno.
          </span>
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
            disabled={activeTypes.length === 0}
          >
            {activeTypes.length === 0 ? (
              <option value="">Sin tipos activos</option>
            ) : (
              activeTypes.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="form-control sm:col-span-2">
          <span className="label-text">Concepto</span>
          <input
            className="input input-bordered"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="Ej.: Almuerzo del equipo"
            autoFocus
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
            className="input input-bordered"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={0}
            step="any"
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
          <button
            type="submit"
            className="btn btn-primary"
            disabled={createMutation.isPending || activeTypes.length === 0}
          >
            {createMutation.isPending ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              "Guardar gasto"
            )}
          </button>
          <Link to="/otros-gastos" className="btn btn-ghost">
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
