import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { fetchClients } from "@/db/queries/clients";
import { createInvoice } from "@/db/queries/invoices";
import {
  fetchCategories,
  fetchCategoryFinishes,
  fetchAllCategoryFormats,
  fetchAllCategoryWorkTypes,
} from "@/db/queries/categories";
import {
  fetchInventoryItems,
  fetchInventoryRecipes,
  fetchMaterialCategories,
} from "@/db/queries/inventory";
import { fetchFormats, fetchPrices } from "@/db/queries/prices";
import { pedidosListSearch } from "@/lib/pedidos-search";
import {
  OrderCashierSection,
  buildCountsPayload,
  computeChangePending,
  computeReceivedAmount,
  computeReceivedUsd,
  emptyOrderCashierState,
  type OrderCashierState,
} from "@/features/invoices/components/OrderCashierSection";
import { OrderHeaderSection } from "@/features/invoices/components/OrderHeaderSection";
import { OrderLineModal } from "@/features/invoices/components/OrderLineModal";
import { OrderLinesTable } from "@/features/invoices/components/OrderLinesTable";
import {
  OrderPaymentSection,
  type OrderPaymentState,
} from "@/features/invoices/components/OrderPaymentSection";
import {
  draftLineSubtotal,
  draftLineToItems,
  isDraftLineValid,
  type DraftLine,
} from "@/features/invoices/lib/order-draft";
import { useAppSettings } from "@/hooks/use-app-settings";
import { todayIso } from "@/lib/format-date";
import { DualMoneyText } from "@/components/common/DualMoneyText";
import { moneyHeading } from "@/lib/format-money";
import { pushFlashMessage } from "@/lib/flash-message";
import { DEFAULT_PAYMENT_CURRENCY, type SaleCurrency } from "@/lib/currency";
import type { AdvancePaymentPayload, CreateInvoiceItemPayload } from "@/types/invoice";

function defaultPaymentState(rate: number): OrderPaymentState {
  return {
    paymentMethod: "efectivo",
    paymentCurrency: DEFAULT_PAYMENT_CURRENCY,
    exchangeRate: rate > 0 ? String(rate) : "",
    transferConcept: "",
  };
}

/**
 * Formulario de nuevo pedido: encabezado compacto, líneas en tabla/modal,
 * anticipo con denominaciones, resumen y cobro integrado.
 *
 * @returns Página de alta de pedido.
 */
export function InvoiceNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const appSettings = useAppSettings();
  const clientsQuery = useQuery({ queryKey: ["clients", "list"], queryFn: fetchClients });
  const categoriesQuery = useQuery({
    queryKey: ["categories", "active"],
    queryFn: () => fetchCategories(true),
  });
  const formatsQuery = useQuery({ queryKey: ["formats"], queryFn: fetchFormats });
  const pricesQuery = useQuery({
    queryKey: ["prices", "active"],
    queryFn: () => fetchPrices(false),
  });
  const categoryWorkTypesQuery = useQuery({
    queryKey: ["category-work-types"],
    queryFn: fetchAllCategoryWorkTypes,
  });
  const categoryFormatsQuery = useQuery({
    queryKey: ["category-formats"],
    queryFn: fetchAllCategoryFormats,
  });
  const categoryFinishesQuery = useQuery({
    queryKey: ["category-finishes"],
    queryFn: fetchCategoryFinishes,
  });
  const recipesQuery = useQuery({
    queryKey: ["inventory", "recipes", "active"],
    queryFn: () => fetchInventoryRecipes(true),
  });
  const inventoryItemsQuery = useQuery({
    queryKey: ["inventory", "list"],
    queryFn: fetchInventoryItems,
  });
  const materialCategoriesQuery = useQuery({
    queryKey: ["inventory", "material-categories", "active"],
    queryFn: () => fetchMaterialCategories(true),
  });

  const defaultCategoryId = categoriesQuery.data?.[0]?.id ?? 1;

  const [clientId, setClientId] = useState(0);
  const [date, setDate] = useState(() => todayIso());
  const [notes, setNotes] = useState("");
  const [registerAdvance, setRegisterAdvance] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [payment, setPayment] = useState<OrderPaymentState>(() =>
    defaultPaymentState(appSettings.usdExchangeRate),
  );
  const [cashier, setCashier] = useState<OrderCashierState>(() => emptyOrderCashierState());
  const [advancePayment, setAdvancePayment] = useState<OrderPaymentState>(() =>
    defaultPaymentState(appSettings.usdExchangeRate),
  );
  const [advanceCashier, setAdvanceCashier] = useState<OrderCashierState>(() =>
    emptyOrderCashierState(),
  );

  const selectedClient = useMemo(
    () => (clientsQuery.data ?? []).find((c) => c.id === clientId) ?? null,
    [clientsQuery.data, clientId],
  );
  const clientCredit = selectedClient?.creditBalance ?? 0;

  const categoryNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of categoriesQuery.data ?? []) {
      map.set(c.id, c.name);
    }
    return map;
  }, [categoriesQuery.data]);

  const formatLabels = useMemo(() => {
    const map = new Map<number, string>();
    for (const f of formatsQuery.data ?? []) {
      map.set(f.id, f.label);
    }
    return map;
  }, [formatsQuery.data]);

  const linesSubtotal = useMemo(
    () => lines.reduce((sum, line) => sum + draftLineSubtotal(line), 0),
    [lines],
  );

  const advancePaymentWithRate: OrderPaymentState = {
    ...advancePayment,
    exchangeRate: advancePayment.exchangeRate || String(appSettings.usdExchangeRate || ""),
  };

  const advanceDisplayRate =
    Number.parseFloat(advancePaymentWithRate.exchangeRate.replace(",", ".")) ||
    appSettings.usdExchangeRate;

  const advanceRateForReceive =
    advancePayment.paymentCurrency === "USD" && advancePayment.paymentMethod === "efectivo"
      ? advanceDisplayRate
      : 0;

  const advanceReceived = useMemo(
    () =>
      registerAdvance
        ? computeReceivedAmount(advancePaymentWithRate, advanceCashier, advanceRateForReceive)
        : 0,
    [registerAdvance, advancePaymentWithRate, advanceCashier, advanceRateForReceive],
  );

  const advanceNum = Math.min(advanceReceived, linesSubtotal);
  const orderTotal = Math.max(linesSubtotal - advanceNum, 0);

  const paymentWithRate: OrderPaymentState = {
    ...payment,
    exchangeRate: payment.exchangeRate || String(appSettings.usdExchangeRate || ""),
  };

  const paymentDisplayRate =
    Number.parseFloat(paymentWithRate.exchangeRate.replace(",", ".")) ||
    appSettings.usdExchangeRate;

  const exchangeRateForReceive =
    payment.paymentCurrency === "USD" && payment.paymentMethod === "efectivo"
      ? paymentDisplayRate
      : 0;

  /** Moneda principal del resumen: sigue el método/moneda de pago del cobro. */
  const summaryPrimary: SaleCurrency =
    payment.paymentMethod === "transferencia" || payment.paymentCurrency === "CUP"
      ? "CUP"
      : "USD";

  const summaryRate = paymentDisplayRate > 0 ? paymentDisplayRate : appSettings.usdExchangeRate;

  const linesValid = lines.length > 0 && lines.every(isDraftLineValid);
  const headerValid = clientId > 0;
  const canCheckout = headerValid && linesValid;

  const creditAppliedPreview = cashier.applyClientCredit
    ? Math.min(clientCredit, orderTotal)
    : 0;
  const effectiveDue = Math.max(0, orderTotal - creditAppliedPreview);

  const received = useMemo(
    () =>
      canCheckout ? computeReceivedAmount(paymentWithRate, cashier, exchangeRateForReceive) : 0,
    [canCheckout, paymentWithRate, cashier, exchangeRateForReceive],
  );

  const pendingAfterPay = Math.max(effectiveDue - received, 0);
  const changePending = useMemo(
    () =>
      canCheckout
        ? computeChangePending(
            received,
            effectiveDue,
            cashier.changeCounts,
            cashier.overpaymentDisposition,
          )
        : false,
    [canCheckout, received, effectiveDue, cashier.changeCounts, cashier.overpaymentDisposition],
  );

  const advanceChangePending = useMemo(
    () =>
      registerAdvance
        ? computeChangePending(
            advanceReceived,
            linesSubtotal,
            advanceCashier.changeCounts,
            advanceCashier.overpaymentDisposition,
          )
        : false,
    [
      registerAdvance,
      advanceReceived,
      linesSubtotal,
      advanceCashier.changeCounts,
      advanceCashier.overpaymentDisposition,
    ],
  );

  /** Hay cobro listo: anticipo ingresado y/o saldo cobrado en esta operación. */
  const hasAdvanceCollect =
    registerAdvance && advanceNum > 1e-6 && !advanceChangePending;
  const hasCheckoutCollect =
    orderTotal > 1e-6 &&
    (received > 1e-6 || creditAppliedPreview > 1e-6) &&
    !changePending;
  const canCollectNow = hasAdvanceCollect || hasCheckoutCollect;
  const showCollectButton = canCheckout && (advanceNum > 1e-6 || orderTotal > 1e-6);

  const buildAdvanceDetail = (): AdvancePaymentPayload | null => {
    if (!registerAdvance || advanceReceived <= 1e-6) {
      return null;
    }
    const isUsd =
      advancePayment.paymentMethod === "efectivo" && advancePayment.paymentCurrency === "USD";
    const isTransfer = advancePayment.paymentMethod === "transferencia";
    return {
      paymentMethod: advancePayment.paymentMethod,
      paymentCurrency: isTransfer ? "CUP" : advancePayment.paymentCurrency,
      counts: !isUsd && !isTransfer ? buildCountsPayload(advanceCashier.counts) : null,
      amountCup: advanceCashier.amountCup.trim()
        ? Number.parseFloat(advanceCashier.amountCup.replace(",", "."))
        : isTransfer
          ? advanceReceived
          : null,
      amountUsd: isUsd ? computeReceivedUsd(advanceCashier) : null,
      exchangeRate: isUsd ? advanceRateForReceive : null,
      transferConcept:
        (advanceCashier.transferConcept || advancePayment.transferConcept).trim() || null,
      changeCounts:
        !isTransfer && advanceCashier.overpaymentDisposition === "change"
          ? buildCountsPayload(advanceCashier.changeCounts)
          : null,
      overpaymentDisposition: advanceCashier.overpaymentDisposition,
    };
  };

  const saveMutation = useMutation({
    mutationFn: async (collectPayment: boolean) => {
      const items: CreateInvoiceItemPayload[] = lines.flatMap((line) =>
        draftLineToItems(line, recipesQuery.data ?? [], categoryWorkTypesQuery.data ?? []),
      );

      if (
        payment.paymentMethod === "efectivo" &&
        payment.paymentCurrency === "USD" &&
        exchangeRateForReceive <= 0 &&
        collectPayment
      ) {
        throw new Error("Indica una tasa USD→CUP válida para el cobro.");
      }
      if (
        registerAdvance &&
        advancePayment.paymentMethod === "efectivo" &&
        advancePayment.paymentCurrency === "USD" &&
        advanceRateForReceive <= 0
      ) {
        throw new Error("Indica una tasa USD→CUP válida para el anticipo.");
      }

      const isUsd = payment.paymentMethod === "efectivo" && payment.paymentCurrency === "USD";
      const isTransfer = payment.paymentMethod === "transferencia";
      const counts = !isUsd && !isTransfer ? buildCountsPayload(cashier.counts) : null;
      const changeCounts =
        !isTransfer && cashier.overpaymentDisposition === "change"
          ? buildCountsPayload(cashier.changeCounts)
          : null;

      const res = await createInvoice({
        clientId,
        date,
        notes: notes.trim() || null,
        advancePayment: advanceNum,
        paid: 0,
        paymentMethod: payment.paymentMethod,
        paymentCurrency: payment.paymentMethod === "transferencia" ? "CUP" : payment.paymentCurrency,
        exchangeRateSnapshot: exchangeRateForReceive || advanceRateForReceive || summaryRate,
        transferConcept: (cashier.transferConcept || payment.transferConcept).trim() || null,
        advancePaymentDetail: buildAdvanceDetail(),
        applyClientCredit: cashier.applyClientCredit,
        initialPayment:
          collectPayment && received > 1e-6
            ? {
                counts,
                amountCup: cashier.amountCup.trim()
                  ? Number.parseFloat(cashier.amountCup.replace(",", "."))
                  : isTransfer
                    ? received
                    : null,
                amountUsd: isUsd ? computeReceivedUsd(cashier) : null,
                exchangeRate: isUsd ? exchangeRateForReceive : null,
                transferConcept: (cashier.transferConcept || payment.transferConcept).trim() || null,
                changeCounts,
                overpaymentDisposition: cashier.overpaymentDisposition,
                applyClientCredit: cashier.applyClientCredit,
              }
            : null,
        items,
      });

      return res;
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      await queryClient.invalidateQueries({ queryKey: ["cashflow"] });
      pushFlashMessage({
        kind: "success",
        text: `Pedido ${res.invoiceNumber} creado correctamente.`,
      });
      await navigate({ to: "/pedidos/$invoiceId", params: { invoiceId: String(res.id) } });
    },
  });

  const openAddLine = () => {
    setEditingLineKey(null);
    setLineModalOpen(true);
  };

  const openEditLine = (key: string) => {
    setEditingLineKey(key);
    setLineModalOpen(true);
  };

  const handleSaveLine = (line: DraftLine) => {
    setLines((prev) => {
      const exists = prev.some((l) => l.key === line.key);
      if (exists) {
        return prev.map((l) => (l.key === line.key ? line : l));
      }
      return [...prev, line];
    });
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const validateBeforeSave = (): boolean => {
    setFormError(null);
    if (!headerValid) {
      setFormError("Selecciona un cliente.");
      return false;
    }
    if (!linesValid) {
      setFormError("Añade al menos una línea válida con categoría, cantidad y precio.");
      return false;
    }
    if (registerAdvance && advanceReceived <= 1e-6) {
      setFormError("Indica el monto o las denominaciones del pago anticipado.");
      return false;
    }
    if (advanceChangePending) {
      setFormError(
        "Hay vuelto pendiente en el anticipo. Cuadra el desglose o elige dejar saldo a favor.",
      );
      return false;
    }
    if (changePending) {
      setFormError(
        "Hay vuelto pendiente por entregar. Cuadra el desglose o elige dejar saldo a favor.",
      );
      return false;
    }
    return true;
  };

  const handleSave = (collectPayment: boolean) => {
    saveMutation.reset();
    if (!validateBeforeSave()) {
      return;
    }
    void saveMutation.mutateAsync(collectPayment);
  };

  const editingLine = editingLineKey ? (lines.find((l) => l.key === editingLineKey) ?? null) : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Nuevo pedido</h1>
          <p className="text-sm text-base-content/70">Recepción de pedido y cobro en un solo flujo.</p>
        </div>
        <Link to="/pedidos" search={pedidosListSearch} className="btn btn-ghost btn-sm">
          Cancelar
        </Link>
      </div>

      {(formError || saveMutation.isError) && (
        <div className="alert alert-error py-2 text-sm">
          <span>
            {formError ??
              (saveMutation.error instanceof Error
                ? saveMutation.error.message
                : "Error al guardar el pedido")}
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <OrderHeaderSection
            clientId={clientId}
            date={date}
            notes={notes}
            clients={clientsQuery.data ?? []}
            onClientChange={setClientId}
            onDateChange={setDate}
            onNotesChange={setNotes}
          />

          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-2 p-3">
              <div className="flex items-center justify-between">
                <h2 className="card-title text-sm">Líneas</h2>
                <button type="button" className="btn btn-primary btn-xs gap-1" onClick={openAddLine}>
                  <Plus className="h-3 w-3" />
                  Añadir línea
                </button>
              </div>
              <OrderLinesTable
                lines={lines}
                categoryNames={categoryNames}
                formatLabels={formatLabels}
                exchangeRate={summaryRate}
                onEdit={openEditLine}
                onRemove={removeLine}
              />
            </div>
          </div>

          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-2 p-3">
              <label className="label cursor-pointer justify-start gap-3 py-0">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary checkbox-sm"
                  checked={registerAdvance}
                  onChange={(e) => setRegisterAdvance(e.target.checked)}
                />
                <span className="label-text font-medium">Registrar pago anticipado</span>
              </label>
              {registerAdvance && (
                <div className="space-y-3 pt-1">
                  <OrderPaymentSection
                    title="Método de pago del anticipo"
                    totalCup={linesSubtotal}
                    value={advancePaymentWithRate}
                    onChange={setAdvancePayment}
                  />
                  <OrderCashierSection
                    balanceDue={linesSubtotal}
                    payment={advancePaymentWithRate}
                    value={advanceCashier}
                    exchangeRate={advanceDisplayRate}
                    onChange={setAdvanceCashier}
                    title="Pago anticipado"
                    hint="El anticipo se registra como ingreso en caja. Si es efectivo, usa la cuadrícula de denominaciones."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Cobro del saldo: solo si no hay anticipo, o si el anticipo ya deja un pendiente. */}
          {orderTotal > 1e-6 && (!registerAdvance || advanceNum > 1e-6) && (
            <>
              <OrderPaymentSection
                title={registerAdvance ? "Método de pago del saldo" : "Método de pago"}
                totalCup={orderTotal}
                value={paymentWithRate}
                onChange={setPayment}
              />

              {canCheckout && (
                <div className="transition-all duration-300">
                  <OrderCashierSection
                    balanceDue={orderTotal}
                    payment={paymentWithRate}
                    value={cashier}
                    exchangeRate={paymentDisplayRate}
                    clientCreditBalance={clientCredit}
                    onChange={setCashier}
                    title={registerAdvance ? "Cobrar saldo" : "Cobrar"}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="card bg-base-100 shadow-sm h-fit lg:sticky lg:top-4">
          <div className="card-body gap-2 p-3 text-sm">
            <h2 className="card-title text-sm">Resumen del pedido</h2>
            <div className="flex justify-between gap-2">
              <span>{moneyHeading("Subtotal líneas", summaryPrimary)}</span>
              <DualMoneyText
                amountCup={linesSubtotal}
                rate={summaryRate}
                primary={summaryPrimary}
              />
            </div>
            {registerAdvance && (
              <div className="flex justify-between gap-2 text-info">
                <span>{moneyHeading("Anticipado", summaryPrimary)}</span>
                <DualMoneyText
                  amountCup={advanceNum}
                  rate={summaryRate}
                  primary={summaryPrimary}
                />
              </div>
            )}
            {creditAppliedPreview > 1e-6 && (
              <div className="flex justify-between gap-2 text-success">
                <span>{moneyHeading("Saldo a favor aplicado", summaryPrimary)}</span>
                <DualMoneyText
                  amountCup={creditAppliedPreview}
                  rate={summaryRate}
                  primary={summaryPrimary}
                  prefix="−"
                />
              </div>
            )}
            <div className="divider my-0" />
            <div className="flex justify-between gap-2 font-semibold">
              <span>{moneyHeading("Total pedido", summaryPrimary)}</span>
              <DualMoneyText
                amountCup={orderTotal}
                rate={summaryRate}
                primary={summaryPrimary}
              />
            </div>
            <div className="flex justify-between gap-2 text-xs text-base-content/70">
              <span>{moneyHeading("Por cobrar ahora", summaryPrimary)}</span>
              <DualMoneyText
                amountCup={effectiveDue}
                rate={summaryRate}
                primary={summaryPrimary}
              />
            </div>
            {canCheckout && received > 0 && (
              <>
                <div className="flex justify-between gap-2 text-success">
                  <span>{moneyHeading("Cobro en esta operación", summaryPrimary)}</span>
                  <DualMoneyText
                    amountCup={Math.min(received, effectiveDue)}
                    rate={summaryRate}
                    primary={summaryPrimary}
                  />
                </div>
                <div className="flex justify-between gap-2 text-primary">
                  <span>{moneyHeading("Pendiente", summaryPrimary)}</span>
                  <DualMoneyText
                    amountCup={pendingAfterPay}
                    rate={summaryRate}
                    primary={summaryPrimary}
                  />
                </div>
              </>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={saveMutation.isPending}
                onClick={() => handleSave(false)}
              >
                {saveMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Guardar sin cobrar"
                )}
              </button>
              {showCollectButton && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={saveMutation.isPending || !canCollectNow}
                  onClick={() => handleSave(true)}
                >
                  {saveMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : hasAdvanceCollect && !hasCheckoutCollect ? (
                    "Guardar y registrar anticipo"
                  ) : (
                    "Guardar y cobrar"
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <OrderLineModal
        open={lineModalOpen}
        editing={editingLine}
        defaultCategoryId={defaultCategoryId}
        categories={categoriesQuery.data ?? []}
        formats={formatsQuery.data ?? []}
        prices={pricesQuery.data ?? []}
        categoryWorkTypes={categoryWorkTypesQuery.data ?? []}
        categoryFormats={categoryFormatsQuery.data ?? []}
        categoryFinishes={categoryFinishesQuery.data ?? []}
        materialCategories={materialCategoriesQuery.data ?? []}
        inventoryItems={inventoryItemsQuery.data ?? []}
        recipes={recipesQuery.data ?? []}
        onClose={() => setLineModalOpen(false)}
        onSave={handleSaveLine}
      />
    </section>
  );
}
