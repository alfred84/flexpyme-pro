import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { fetchCashSessionsForInvoice, registerCashPayment } from "@/db/queries/cashier";
import { fetchInvoiceDetail } from "@/db/queries/invoices";
import { useAppSettings } from "@/hooks/use-app-settings";
import { formatMoney } from "@/lib/format-money";
import { CASH_DENOMINATIONS } from "@/types/cashier";

function emptyCounts(): Record<string, number> {
  const o: Record<string, number> = {};
  for (const d of CASH_DENOMINATIONS) {
    o[String(d)] = 0;
  }
  return o;
}

function sumCounts(counts: Record<string, number>): number {
  let s = 0;
  for (const d of CASH_DENOMINATIONS) {
    const n = counts[String(d)] ?? 0;
    s += d * n;
  }
  return s;
}

/**
 * Cobro de pedido: efectivo CUP (conteo), efectivo USD o transferencia, enlazado a `cash_transactions`.
 *
 * @returns Página de caja del pedido.
 */
export function InvoiceCashierPage() {
  const params = useParams({ strict: false }) as { invoiceId?: string };
  const invoiceId = Number(params.invoiceId);
  const queryClient = useQueryClient();
  const appSettings = useAppSettings();
  const [counts, setCounts] = useState(emptyCounts);
  const [amountCup, setAmountCup] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [transferConcept, setTransferConcept] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["invoices", "detail", invoiceId],
    queryFn: () => fetchInvoiceDetail(invoiceId),
    enabled: Number.isFinite(invoiceId) && invoiceId > 0,
  });

  const sessionsQuery = useQuery({
    queryKey: ["cashier", "sessions", invoiceId],
    queryFn: () => fetchCashSessionsForInvoice(invoiceId),
    enabled: Number.isFinite(invoiceId) && invoiceId > 0,
  });

  const registerMutation = useMutation({
    mutationFn: registerCashPayment,
    onSuccess: (data) => {
      setFeedback(
        `Pago registrado (${data.paymentStatus}). Vuelto: ${formatMoney(data.changeGiven)} · Pendiente: ${formatMoney(data.invoiceNewBalance)}`,
      );
      setCounts(emptyCounts());
      setAmountCup("");
      setAmountUsd("");
      void queryClient.invalidateQueries({ queryKey: ["invoices", "detail", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["cashier", "sessions", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoices", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["clients"] });
      void queryClient.invalidateQueries({ queryKey: ["cashflow"] });
    },
    onError: (err: Error) => {
      setFeedback(err.message ?? "No se pudo registrar el pago");
    },
  });

  const inv = detailQuery.data?.invoice;
  const balance = inv?.balance ?? 0;
  const paymentMethod = inv?.paymentMethod ?? "efectivo";
  const paymentCurrency = inv?.paymentCurrency ?? "CUP";
  const isTransfer = paymentMethod === "transferencia";
  const isUsd = !isTransfer && paymentCurrency === "USD";

  const rate =
    Number.parseFloat(exchangeRate.replace(",", ".")) ||
    inv?.exchangeRateSnapshot ||
    appSettings.usdExchangeRate ||
    0;

  const received = useMemo(() => {
    if (isTransfer || (paymentMethod === "efectivo" && paymentCurrency === "CUP" && !isUsd)) {
      const direct = Number.parseFloat(amountCup.replace(",", ".")) || 0;
      const fromCounts = sumCounts(counts);
      return direct > 0 ? direct : fromCounts;
    }
    if (isUsd) {
      const usd = Number.parseFloat(amountUsd.replace(",", ".")) || 0;
      return rate > 0 ? usd * rate : 0;
    }
    return Number.parseFloat(amountCup.replace(",", ".")) || 0;
  }, [isTransfer, isUsd, paymentMethod, paymentCurrency, amountCup, amountUsd, rate, counts]);

  const changeDue = Math.max(0, received - balance);
  const applied = Math.min(received, balance);

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return (
      <div className="alert alert-warning">
        <span>Identificador de pedido no válido.</span>
      </div>
    );
  }

  function setDenom(key: string, value: number) {
    const v = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    setCounts((prev) => ({ ...prev, [key]: v }));
  }

  function submit() {
    setFeedback(null);
    const payloadCounts: Record<string, number> = {};
    for (const d of CASH_DENOMINATIONS) {
      const k = String(d);
      payloadCounts[k] = counts[k] ?? 0;
    }
    const hasCounts = Object.values(payloadCounts).some((n) => n > 0);
    registerMutation.mutate({
      invoiceId,
      counts: hasCounts ? payloadCounts : null,
      amountCup: amountCup.trim() ? Number.parseFloat(amountCup.replace(",", ".")) : null,
      amountUsd: amountUsd.trim() ? Number.parseFloat(amountUsd.replace(",", ".")) : null,
      exchangeRate: isUsd ? rate : null,
      transferConcept: transferConcept.trim() || null,
    });
  }

  const canPay = balance > 1e-6 && received > 1e-6;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Cobro</h1>
          {inv && <p className="text-lg font-mono">{inv.invoiceNumber}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/pedidos/$invoiceId" params={{ invoiceId: String(invoiceId) }} className="btn btn-ghost btn-sm">
            Volver al pedido
          </Link>
          <Link to="/pedidos" className="btn btn-ghost btn-sm">
            Listado
          </Link>
        </div>
      </div>

      {detailQuery.isLoading && <p>Cargando pedido...</p>}
      {detailQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudo cargar el pedido.</span>
        </div>
      )}

      {inv && (
        <>
          <div className="alert alert-info text-sm">
            Forma de pago del pedido:{" "}
            <strong>
              {isTransfer ? "Transferencia (CUP)" : isUsd ? "Efectivo USD" : "Efectivo CUP"}
            </strong>
            . El cobro se registrará en el flujo de caja.
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h2 className="card-title text-base">Resumen</h2>
                <dl className="space-y-1 text-sm">
                  <div>
                    <dt className="text-base-content/60">Cliente</dt>
                    <dd>{inv.clientName}</dd>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <dt>Pendiente a cobrar</dt>
                    <dd className="text-primary">{formatMoney(balance)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Recibido</dt>
                    <dd>{formatMoney(received)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Se aplica</dt>
                    <dd>{formatMoney(applied)}</dd>
                  </div>
                  <div className="flex justify-between text-secondary">
                    <dt>Vuelto</dt>
                    <dd>{formatMoney(changeDue)}</dd>
                  </div>
                </dl>
                {balance <= 1e-6 && (
                  <div className="alert alert-success mt-2 text-sm">No hay saldo pendiente.</div>
                )}
              </div>
            </div>

            <div className="card bg-base-100 shadow">
              <div className="card-body space-y-3">
                <h2 className="card-title text-base">Registrar cobro</h2>

                {isTransfer && (
                  <>
                    <label className="form-control">
                      <span className="label-text">Monto recibido (CUP)</span>
                      <input
                        className="input input-bordered"
                        inputMode="decimal"
                        value={amountCup}
                        onChange={(e) => setAmountCup(e.target.value)}
                      />
                    </label>
                    <label className="form-control">
                      <span className="label-text">Referencia / concepto</span>
                      <input
                        className="input input-bordered"
                        value={transferConcept}
                        onChange={(e) => setTransferConcept(e.target.value)}
                      />
                    </label>
                  </>
                )}

                {isUsd && (
                  <>
                    <label className="form-control">
                      <span className="label-text">Tasa (1 USD = CUP)</span>
                      <input
                        className="input input-bordered"
                        inputMode="decimal"
                        value={exchangeRate || String(inv.exchangeRateSnapshot ?? appSettings.usdExchangeRate)}
                        onChange={(e) => setExchangeRate(e.target.value)}
                      />
                    </label>
                    <label className="form-control">
                      <span className="label-text">Monto recibido (USD)</span>
                      <input
                        className="input input-bordered"
                        inputMode="decimal"
                        value={amountUsd}
                        onChange={(e) => setAmountUsd(e.target.value)}
                      />
                    </label>
                    {rate > 0 && (
                      <p className="text-sm">Equivalente: {formatMoney(received)}</p>
                    )}
                  </>
                )}

                {!isTransfer && !isUsd && (
                  <>
                    <p className="text-xs text-base-content/60">Conteo de billetes o monto total:</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {CASH_DENOMINATIONS.map((d) => (
                        <label key={d} className="form-control">
                          <span className="label-text text-xs font-mono">{formatMoney(d)}</span>
                          <input
                            type="number"
                            min={0}
                            className="input input-bordered input-sm"
                            value={counts[String(d)] ?? 0}
                            onChange={(e) => setDenom(String(d), Number(e.target.value))}
                          />
                        </label>
                      ))}
                    </div>
                    <label className="form-control">
                      <span className="label-text">O monto total CUP</span>
                      <input
                        className="input input-bordered input-sm"
                        inputMode="decimal"
                        value={amountCup}
                        onChange={(e) => setAmountCup(e.target.value)}
                      />
                    </label>
                  </>
                )}

                <button
                  type="button"
                  className="btn btn-primary w-full"
                  disabled={!canPay || registerMutation.isPending}
                  onClick={() => submit()}
                >
                  {registerMutation.isPending ? "Registrando..." : "Registrar cobro"}
                </button>
                {feedback && (
                  <div
                    className={`alert text-sm ${registerMutation.isError ? "alert-error" : "alert-success"}`}
                  >
                    <span>{feedback}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title text-base">Historial de caja (conteo físico)</h2>
              {sessionsQuery.isLoading && <p className="text-sm">Cargando...</p>}
              {sessionsQuery.data && sessionsQuery.data.length === 0 && (
                <p className="text-sm text-base-content/60">
                  Sin sesiones de conteo (transferencia/USD solo aparecen en Flujo de caja).
                </p>
              )}
              {sessionsQuery.data && sessionsQuery.data.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th className="text-right">Pendiente</th>
                        <th className="text-right">Recibido</th>
                        <th className="text-right">Vuelto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionsQuery.data.map((row) => (
                        <tr key={row.id}>
                          <td className="whitespace-nowrap text-xs">{row.date}</td>
                          <td className="text-right">{formatMoney(row.totalAmount)}</td>
                          <td className="text-right">{formatMoney(row.amountReceived)}</td>
                          <td className="text-right">{formatMoney(row.changeGiven)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
