import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { fetchClientById } from "@/db/queries/clients";
import { fetchCashSessionsForInvoice, registerCashPayment } from "@/db/queries/cashier";
import { fetchInvoiceDetail } from "@/db/queries/invoices";
import {
  OrderCashierSection,
  buildCountsPayload,
  computeChangePending,
  computeReceivedAmount,
  computeReceivedUsd,
  emptyOrderCashierState,
  type OrderCashierState,
} from "@/features/invoices/components/OrderCashierSection";
import type { OrderPaymentState } from "@/features/invoices/components/OrderPaymentSection";
import { DualMoneyText } from "@/components/common/DualMoneyText";
import { useAppSettings } from "@/hooks/use-app-settings";
import type { SaleCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/format-date";
import { formatAmount, formatMoney, moneyHeading } from "@/lib/format-money";
import { pedidosListSearch } from "@/lib/pedidos-search";
import type { PaymentCurrency, PaymentMethod } from "@/types/invoice";

/**
 * Cobro de pedido: efectivo CUP/USD o transferencia, vuelto o saldo a favor,
 * enlazado a `cash_transactions`.
 *
 * @returns Página de caja del pedido.
 */
export function InvoiceCashierPage() {
  const params = useParams({ strict: false }) as { invoiceId?: string };
  const invoiceId = Number(params.invoiceId);
  const queryClient = useQueryClient();
  const appSettings = useAppSettings();
  const [cashier, setCashier] = useState<OrderCashierState>(() => emptyOrderCashierState());
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

  const inv = detailQuery.data?.invoice;
  const clientQuery = useQuery({
    queryKey: ["clients", "detail", inv?.clientId],
    queryFn: () => fetchClientById(inv!.clientId),
    enabled: inv != null && inv.clientId > 0,
  });

  const registerMutation = useMutation({
    mutationFn: registerCashPayment,
    onSuccess: (data) => {
      const parts = [
        `Pago registrado (${data.paymentStatus}).`,
        data.changeGiven > 1e-6 ? `Vuelto: ${formatMoney(data.changeGiven)}.` : null,
        data.creditAdded > 1e-6 ? `Saldo a favor: ${formatMoney(data.creditAdded)}.` : null,
        data.creditApplied > 1e-6
          ? `Crédito aplicado: ${formatMoney(data.creditApplied)}.`
          : null,
        `Pendiente: ${formatMoney(data.invoiceNewBalance)}.`,
      ].filter(Boolean);
      setFeedback(parts.join(" "));
      setCashier(emptyOrderCashierState());
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

  const balance = inv?.balance ?? 0;
  const paymentMethod = (inv?.paymentMethod ?? "efectivo") as PaymentMethod;
  const paymentCurrency = (inv?.paymentCurrency ?? "CUP") as PaymentCurrency;
  const isTransfer = paymentMethod === "transferencia";
  const isUsd = !isTransfer && paymentCurrency === "USD";
  const summaryPrimary: SaleCurrency = isUsd ? "USD" : "CUP";

  const rate =
    inv?.exchangeRateSnapshot ||
    appSettings.usdExchangeRate ||
    0;

  const payment: OrderPaymentState = {
    paymentMethod,
    paymentCurrency,
    exchangeRate: String(rate || ""),
    transferConcept: "",
  };

  const clientCredit = clientQuery.data?.creditBalance ?? 0;
  const creditAppliedPreview = cashier.applyClientCredit
    ? Math.min(clientCredit, balance)
    : 0;
  const effectiveDue = Math.max(0, balance - creditAppliedPreview);

  const received = useMemo(
    () => computeReceivedAmount(payment, cashier, rate),
    [payment, cashier, rate],
  );

  const changePending = useMemo(
    () =>
      computeChangePending(
        received,
        effectiveDue,
        cashier.changeCounts,
        cashier.overpaymentDisposition,
      ),
    [received, effectiveDue, cashier.changeCounts, cashier.overpaymentDisposition],
  );

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return (
      <div className="alert alert-warning">
        <span>Identificador de pedido no válido.</span>
      </div>
    );
  }

  function submit() {
    setFeedback(null);
    const counts = !isUsd && !isTransfer ? buildCountsPayload(cashier.counts) : null;
    const changeCounts =
      !isTransfer && cashier.overpaymentDisposition === "change"
        ? buildCountsPayload(cashier.changeCounts)
        : null;
    registerMutation.mutate({
      invoiceId,
      counts,
      amountCup: cashier.amountCup.trim()
        ? Number.parseFloat(cashier.amountCup.replace(",", "."))
        : isTransfer
          ? received
          : null,
      amountUsd: isUsd ? computeReceivedUsd(cashier) : null,
      exchangeRate: isUsd ? rate : null,
      transferConcept: cashier.transferConcept.trim() || null,
      changeCounts,
      overpaymentDisposition: cashier.overpaymentDisposition,
      applyClientCredit: cashier.applyClientCredit,
    });
  }

  const canPay =
    balance > 1e-6 &&
    (received > 1e-6 || creditAppliedPreview > 1e-6) &&
    !changePending;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Cobro</h1>
          {inv && <p className="text-lg font-mono">{inv.invoiceNumber}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/pedidos/$invoiceId"
            params={{ invoiceId: String(invoiceId) }}
            className="btn btn-ghost btn-sm"
          >
            Volver al pedido
          </Link>
          <Link to="/pedidos" search={pedidosListSearch} className="btn btn-ghost btn-sm">
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
            . El cobro se registrará en el flujo de caja. Puedes devolver vuelto o dejar el exceso
            como saldo a favor.
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
                  <div className="flex justify-between gap-2 font-semibold">
                    <dt>{moneyHeading("Pendiente a cobrar", summaryPrimary)}</dt>
                    <dd className="text-primary">
                      <DualMoneyText amountCup={balance} rate={rate} primary={summaryPrimary} />
                    </dd>
                  </div>
                  {clientCredit > 1e-6 && (
                    <div className="flex justify-between gap-2 text-success">
                      <dt>{moneyHeading("Saldo a favor", "CUP")}</dt>
                      <dd>{formatMoney(clientCredit, "CUP")}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <dt>{moneyHeading("Por cobrar ahora", summaryPrimary)}</dt>
                    <dd>
                      <DualMoneyText
                        amountCup={effectiveDue}
                        rate={rate}
                        primary={summaryPrimary}
                      />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>{moneyHeading("Recibido", summaryPrimary)}</dt>
                    <dd>
                      <DualMoneyText amountCup={received} rate={rate} primary={summaryPrimary} />
                    </dd>
                  </div>
                </dl>
                {balance <= 1e-6 && (
                  <div className="alert alert-success mt-2 text-sm">No hay saldo pendiente.</div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <OrderCashierSection
                balanceDue={balance}
                payment={payment}
                value={cashier}
                exchangeRate={rate}
                clientCreditBalance={clientCredit}
                onChange={setCashier}
              />
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
                        <th className="text-right">{moneyHeading("Pendiente")}</th>
                        <th className="text-right">{moneyHeading("Recibido")}</th>
                        <th className="text-right">{moneyHeading("Vuelto")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionsQuery.data.map((row) => (
                        <tr key={row.id}>
                          <td className="whitespace-nowrap text-xs">{formatDate(row.date)}</td>
                          <td className="text-right">{formatAmount(row.totalAmount)}</td>
                          <td className="text-right">{formatAmount(row.amountReceived)}</td>
                          <td className="text-right">{formatAmount(row.changeGiven)}</td>
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
