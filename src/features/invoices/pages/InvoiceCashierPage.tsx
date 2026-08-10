import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { fetchClientById } from "@/db/queries/clients";
import { fetchCashSessionsForInvoice, registerCashPayment } from "@/db/queries/cashier";
import { fetchInvoiceDetail, updateInvoicePaymentConfig } from "@/db/queries/invoices";
import {
  OrderCashierSection,
  buildCountsPayload,
  computeChangePending,
  computeReceivedAmount,
  computeReceivedUsd,
  emptyDenominationCounts,
  emptyOrderCashierState,
  type OrderCashierState,
} from "@/features/invoices/components/OrderCashierSection";
import {
  emptyOrderPaymentState,
  isMixtoSplitValid,
  OrderPaymentSection,
  resolveDueSplit,
  type OrderPaymentState,
} from "@/features/invoices/components/OrderPaymentSection";
import {
  isInvoiceUnpaid,
  paymentStateFromInvoice,
} from "@/features/invoices/lib/invoice-payment";
import { DualMoneyText } from "@/components/common/DualMoneyText";
import { useAppSettings } from "@/hooks/use-app-settings";
import type { SaleCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/format-date";
import { formatAmount, formatMoney, moneyHeading } from "@/lib/format-money";
import { pedidosListSearch } from "@/lib/pedidos-search";

/**
 * Cobro de pedido: efectivo CUP/USD/Mixto o transferencia, vuelto o saldo a favor.
 * Si el pedido aún no tiene cobros, permite cambiar método/moneda/tasa antes de cobrar.
 *
 * @returns Página de caja del pedido.
 */
export function InvoiceCashierPage() {
  const params = useParams({ strict: false }) as { invoiceId?: string };
  const invoiceId = Number(params.invoiceId);
  const queryClient = useQueryClient();
  const appSettings = useAppSettings();
  const [cashier, setCashier] = useState<OrderCashierState>(() => emptyOrderCashierState());
  /** Borrador local solo mientras el pedido está impago y el usuario edita la forma de pago. */
  const [paymentDraft, setPaymentDraft] = useState<OrderPaymentState | null>(null);
  const [draftInvoiceId, setDraftInvoiceId] = useState<number | null>(null);
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

  // Al cambiar de pedido, descartar el borrador (ajuste de estado durante el render).
  if (inv && draftInvoiceId !== inv.id) {
    setDraftInvoiceId(inv.id);
    setPaymentDraft(null);
  }

  const canChangePayment = inv ? isInvoiceUnpaid(inv) : false;

  const serverPayment = useMemo(
    () => (inv ? paymentStateFromInvoice(inv, appSettings.usdExchangeRate) : null),
    [inv, appSettings.usdExchangeRate],
  );

  /**
   * Impago + borrador → ediciones del usuario.
   * Cobrado o sin borrador → siempre la forma de pago del servidor.
   */
  const payment =
    canChangePayment && paymentDraft != null ? paymentDraft : serverPayment;

  const activePayment = useMemo(
    () => payment ?? emptyOrderPaymentState(appSettings.usdExchangeRate),
    [payment, appSettings.usdExchangeRate],
  );

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!inv || !payment) {
        throw new Error("Pedido no cargado");
      }
      const rate =
        Number.parseFloat(payment.exchangeRate.replace(",", ".")) ||
        inv.exchangeRateSnapshot ||
        appSettings.usdExchangeRate ||
        0;
      const currency =
        payment.paymentMethod === "transferencia" ? "CUP" : payment.paymentCurrency;
      const due = resolveDueSplit(
        currency,
        inv.totalUsd > 0 ? inv.totalUsd : rate > 0 ? inv.total / rate : 0,
        inv.balance > 0 ? inv.balance : inv.total,
        payment.dueUsd,
        payment.dueCup,
      );

      if (canChangePayment) {
        if (rate <= 0) {
          throw new Error("Indica una tasa USD→CUP válida.");
        }
        if (
          currency === "mixto" &&
          !isMixtoSplitValid(due.dueUsd, due.dueCup, rate, inv.balance > 0 ? inv.balance : inv.total)
        ) {
          throw new Error(
            "En modo Mixto, due USD × tasa + due CUP debe coincidir con el pendiente del pedido.",
          );
        }
        await updateInvoicePaymentConfig({
          id: invoiceId,
          paymentMethod: payment.paymentMethod,
          paymentCurrency: currency,
          exchangeRateSnapshot: rate,
          dueUsd: due.dueUsd,
          dueCup: due.dueCup,
        });
      }

      const isTransferPay = payment.paymentMethod === "transferencia";
      const isUsdPay = !isTransferPay && currency === "USD";
      const isMixtoPay = !isTransferPay && currency === "mixto";
      const receivedAmount = computeReceivedAmount(payment, cashier, rate);
      const counts = !isUsdPay && !isTransferPay ? buildCountsPayload(cashier.counts) : null;
      const usdCounts =
        isUsdPay || isMixtoPay ? buildCountsPayload(cashier.usdCounts, "USD") : null;
      const changeCounts =
        !isTransferPay && cashier.overpaymentDisposition === "change"
          ? buildCountsPayload(cashier.changeCounts)
          : null;
      const changeUsdCounts =
        !isTransferPay && cashier.overpaymentDisposition === "change"
          ? buildCountsPayload(cashier.changeUsdCounts, "USD")
          : null;
      const recvUsd = computeReceivedUsd(cashier);

      return registerCashPayment({
        invoiceId,
        counts,
        usdCounts,
        amountCup: cashier.amountCup.trim()
          ? Number.parseFloat(cashier.amountCup.replace(",", "."))
          : isTransferPay
            ? receivedAmount
            : null,
        amountUsd: recvUsd > 0 ? recvUsd : null,
        exchangeRate: rate > 0 ? rate : null,
        transferConcept: cashier.transferConcept.trim() || null,
        changeCounts,
        changeUsdCounts,
        overpaymentDisposition: cashier.overpaymentDisposition,
        applyClientCredit: cashier.applyClientCredit,
      });
    },
    onSuccess: (data) => {
      const parts = [
        `Pago registrado (${data.paymentStatus}).`,
        data.changeGiven > 1e-6 ? `Vuelto: ${formatMoney(data.changeGiven)}.` : null,
        data.changeGivenUsd > 1e-6 ? `Vuelto USD: ${formatMoney(data.changeGivenUsd, "USD")}.` : null,
        data.creditAdded > 1e-6 ? `Saldo a favor: ${formatMoney(data.creditAdded)}.` : null,
        data.creditApplied > 1e-6
          ? `Crédito aplicado: ${formatMoney(data.creditApplied)}.`
          : null,
        `Pendiente: ${formatMoney(data.invoiceNewBalance)}.`,
      ].filter(Boolean);
      setFeedback(parts.join(" "));
      setCashier(emptyOrderCashierState());
      setPaymentDraft(null);
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
  const balanceUsd = inv?.balanceUsd ?? 0;

  const rate =
    Number.parseFloat(activePayment.exchangeRate.replace(",", ".")) ||
    inv?.exchangeRateSnapshot ||
    appSettings.usdExchangeRate ||
    0;

  const isTransfer = activePayment.paymentMethod === "transferencia";
  const currency = isTransfer ? "CUP" : activePayment.paymentCurrency;
  const isUsd = !isTransfer && currency === "USD";
  const isMixto = !isTransfer && currency === "mixto";
  const summaryPrimary: SaleCurrency = isUsd ? "USD" : "CUP";

  const collectDue = resolveDueSplit(
    currency,
    inv && inv.totalUsd > 0 ? inv.totalUsd : rate > 0 ? balance / (rate || 1) : 0,
    balance,
    activePayment.dueUsd,
    activePayment.dueCup,
  );
  const collectDueCup =
    isMixto && (collectDue.dueUsd > 1e-6 || collectDue.dueCup > 1e-6)
      ? collectDue.dueUsd * rate + collectDue.dueCup
      : balance;

  const clientCredit = clientQuery.data?.creditBalance ?? 0;
  const creditAppliedPreview = cashier.applyClientCredit
    ? Math.min(clientCredit, collectDueCup)
    : 0;
  const effectiveDue = Math.max(0, collectDueCup - creditAppliedPreview);

  const received = useMemo(
    () => computeReceivedAmount(activePayment, cashier, rate),
    [activePayment, cashier, rate],
  );

  const changePending = useMemo(
    () =>
      computeChangePending(
        received,
        effectiveDue,
        cashier.changeCounts,
        cashier.overpaymentDisposition,
        cashier.changeUsdCounts,
        rate,
      ),
    [
      received,
      effectiveDue,
      cashier.changeCounts,
      cashier.changeUsdCounts,
      cashier.overpaymentDisposition,
      rate,
    ],
  );

  const handlePaymentChange = (next: OrderPaymentState) => {
    if (!canChangePayment) return;
    const currencyChanged = next.paymentCurrency !== activePayment.paymentCurrency;
    const methodChanged = next.paymentMethod !== activePayment.paymentMethod;
    setPaymentDraft(next);
    if (currencyChanged || methodChanged) {
      setCashier((prev) => ({
        ...prev,
        amountCup: "",
        amountUsd: "",
        counts: emptyDenominationCounts(),
        usdCounts: emptyDenominationCounts("USD"),
        changeCounts: emptyDenominationCounts(),
        changeUsdCounts: emptyDenominationCounts("USD"),
      }));
    }
  };

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return (
      <div className="alert alert-warning">
        <span>Identificador de pedido no válido.</span>
      </div>
    );
  }

  function submit() {
    setFeedback(null);
    void registerMutation.mutateAsync();
  }

  const canPay =
    collectDueCup > 1e-6 &&
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

      {inv && payment && (
        <>
          <div className="alert alert-info text-sm">
            {canChangePayment ? (
              <>
                Este pedido aún no tiene cobros: puedes cambiar método, moneda, tasa y split Mixto
                antes de registrar el pago.
              </>
            ) : (
              <>
                Forma de pago del pedido:{" "}
                <strong>
                  {isTransfer
                    ? "Transferencia (CUP)"
                    : isUsd
                      ? "Efectivo USD"
                      : isMixto
                        ? "Efectivo Mixto (USD + CUP)"
                        : "Efectivo CUP"}
                </strong>
                . Ya hay cobros o anticipo; no se puede cambiar la forma de pago aquí.
              </>
            )}
          </div>

          {canChangePayment && (
            <OrderPaymentSection
              title="Forma de pago"
              totalCup={balance > 0 ? balance : inv.total}
              totalUsd={
                inv.totalUsd > 0
                  ? inv.totalUsd
                  : rate > 0
                    ? (balance > 0 ? balance : inv.total) / rate
                    : 0
              }
              value={payment}
              onChange={handlePaymentChange}
            />
          )}

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
                      <DualMoneyText
                        amountCup={collectDueCup}
                        rate={rate}
                        primary={summaryPrimary}
                      />
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
                balanceDue={collectDueCup}
                balanceDueUsd={isMixto ? collectDue.dueUsd : balanceUsd}
                payment={activePayment}
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
                        <th className="text-right">Recibido CUP</th>
                        <th className="text-right">Recibido USD</th>
                        <th className="text-right">Vuelto CUP</th>
                        <th className="text-right">Vuelto USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionsQuery.data.map((row) => (
                        <tr key={row.id}>
                          <td className="whitespace-nowrap text-xs">{formatDate(row.date)}</td>
                          <td className="text-right">{formatAmount(row.amountReceived)}</td>
                          <td className="text-right">{formatAmount(row.amountReceivedUsd)}</td>
                          <td className="text-right">{formatAmount(row.changeGiven)}</td>
                          <td className="text-right">{formatAmount(row.changeGivenUsd)}</td>
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
