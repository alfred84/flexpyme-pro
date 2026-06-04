import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { createCashTransaction } from "@/db/queries/cashflow";
import { useAppSettings } from "@/hooks/use-app-settings";
import { pushFlashMessage } from "@/lib/flash-message";

/**
 * Registro manual de un movimiento de caja (ingreso/egreso, CUP/USD).
 *
 * @returns Página de nuevo movimiento de caja.
 */
export function CashflowNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const settings = useAppSettings();

  const [transactionType, setTransactionType] = useState<"ingreso" | "egreso">("ingreso");
  const [concept, setConcept] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "transferencia">("efectivo");
  const [currency, setCurrency] = useState<"CUP" | "USD">("CUP");
  const [amount, setAmount] = useState("");
  const [exchangeRate, setExchangeRate] = useState(String(settings.usdExchangeRate || ""));
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createCashTransaction,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cashflow"] });
      pushFlashMessage({ kind: "success", text: "Movimiento registrado." });
      await navigate({ to: "/caja" });
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = async (e: React.FormEvent) => {
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
    let rate = 0;
    if (currency === "USD") {
      rate = Number(exchangeRate) || 0;
      if (rate <= 0) {
        setError("Indica una tasa USD→CUP válida.");
        return;
      }
      amountUsd = value;
      amountCup = value * rate;
    }

    await mutation.mutateAsync({
      transactionType,
      concept: concept.trim(),
      referenceType: "otro",
      amountCup,
      amountUsd,
      exchangeRate: rate,
      paymentMethod,
      denominationBreakdown: null,
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nuevo movimiento de caja</h1>
        <Link to="/caja" className="btn btn-ghost btn-sm">
          Cancelar
        </Link>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <form className="mx-auto grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <div className="form-control">
          <label className="label" htmlFor="cf-type">
            <span className="label-text">Tipo</span>
          </label>
          <select
            id="cf-type"
            className="select select-bordered"
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value as "ingreso" | "egreso")}
          >
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
          </select>
        </div>
        <div className="form-control">
          <label className="label" htmlFor="cf-method">
            <span className="label-text">Forma de pago</span>
          </label>
          <select
            id="cf-method"
            className="select select-bordered"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as "efectivo" | "transferencia")}
          >
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
          </select>
        </div>
        <div className="form-control sm:col-span-2">
          <label className="label" htmlFor="cf-concept">
            <span className="label-text">Concepto</span>
          </label>
          <input
            id="cf-concept"
            className="input input-bordered"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
          />
        </div>
        <div className="form-control">
          <label className="label" htmlFor="cf-currency">
            <span className="label-text">Moneda</span>
          </label>
          <select
            id="cf-currency"
            className="select select-bordered"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "CUP" | "USD")}
          >
            <option value="CUP">CUP</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div className="form-control">
          <label className="label" htmlFor="cf-amount">
            <span className="label-text">Importe ({currency})</span>
          </label>
          <input
            id="cf-amount"
            type="number"
            className="input input-bordered"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        {currency === "USD" && (
          <div className="form-control sm:col-span-2">
            <label className="label" htmlFor="cf-rate">
              <span className="label-text">Tasa USD → CUP</span>
            </label>
            <input
              id="cf-rate"
              type="number"
              className="input input-bordered"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <span className="loading loading-spinner loading-sm" /> : "Registrar movimiento"}
          </button>
        </div>
      </form>
    </section>
  );
}
