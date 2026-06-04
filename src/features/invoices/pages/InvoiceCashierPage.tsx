import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { fetchCashSessionsForInvoice, registerCashPayment } from "@/db/queries/cashier";
import { fetchInvoiceDetail } from "@/db/queries/invoices";
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
 * Cash register for an invoice: denomination counts, change, register payment.
 */
export function InvoiceCashierPage() {
  const params = useParams({ strict: false }) as { invoiceId?: string };
  const invoiceId = Number(params.invoiceId);
  const queryClient = useQueryClient();
  const [counts, setCounts] = useState(emptyCounts);
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
        `Pago registrado. Vuelto: ${formatMoney(data.changeGiven)} · Nuevo pendiente: ${formatMoney(data.invoiceNewBalance)}`,
      );
      setCounts(emptyCounts());
      void queryClient.invalidateQueries({ queryKey: ["invoices", "detail", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["cashier", "sessions", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["invoices", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (err: Error) => {
      setFeedback(err.message ?? "No se pudo registrar el pago");
    },
  });

  const balance = detailQuery.data?.invoice.balance ?? 0;
  const received = useMemo(() => sumCounts(counts), [counts]);
  const changeDue = Math.max(0, received - balance);
  const applied = Math.min(received, balance);

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return (
      <div className="alert alert-warning">
        <span>Identificador de factura no válido.</span>
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
    registerMutation.mutate({ invoiceId, counts: payloadCounts });
  }

  const inv = detailQuery.data?.invoice;
  const canPay = balance > 1e-6 && received > 1e-6;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Caja</h1>
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
          <span>No se pudo cargar la factura.</span>
        </div>
      )}

      {inv && (
        <>
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
                    <dt>Recibido (conteo)</dt>
                    <dd>{formatMoney(received)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Se aplica a la factura</dt>
                    <dd>{formatMoney(applied)}</dd>
                  </div>
                  <div className="flex justify-between text-secondary">
                    <dt>Vuelto</dt>
                    <dd>{formatMoney(changeDue)}</dd>
                  </div>
                </dl>
                {balance <= 1e-6 && (
                  <div className="alert alert-success mt-2 text-sm">No hay saldo pendiente en esta factura.</div>
                )}
              </div>
            </div>

            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h2 className="card-title text-base">Billetes y monedas</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {CASH_DENOMINATIONS.map((d) => (
                    <label key={d} className="form-control">
                      <span className="label-text text-xs font-mono">{formatMoney(d)}</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="input input-bordered input-sm"
                        value={counts[String(d)] ?? 0}
                        onChange={(e) => setDenom(String(d), Number(e.target.value))}
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-primary mt-4 w-full"
                  disabled={!canPay || registerMutation.isPending}
                  onClick={() => submit()}
                >
                  {registerMutation.isPending ? "Registrando..." : "Registrar pago en caja"}
                </button>
                {feedback && (
                  <div className={`alert mt-2 text-sm ${registerMutation.isError ? "alert-error" : "alert-success"}`}>
                    <span>{feedback}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title text-base">Historial de caja (esta factura)</h2>
              {sessionsQuery.isLoading && <p className="text-sm">Cargando...</p>}
              {sessionsQuery.data && sessionsQuery.data.length === 0 && (
                <p className="text-sm text-base-content/60">Aún no hay movimientos registrados.</p>
              )}
              {sessionsQuery.data && sessionsQuery.data.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th className="text-right">Pendiente (sesión)</th>
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
