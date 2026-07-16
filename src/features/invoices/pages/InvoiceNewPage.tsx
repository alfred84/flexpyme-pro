import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { fetchClients } from "@/db/queries/clients";
import { createInvoice } from "@/db/queries/invoices";
import { fetchCategories, fetchCategoryFinishes, fetchCategoryServices } from "@/db/queries/categories";
import { fetchFormats, fetchPrices } from "@/db/queries/prices";
import { pedidosListSearch } from "@/lib/pedidos-search";
import {
  OrderCashierSection,
  buildCountsPayload,
  computeChangePending,
  computeReceivedAmount,
  emptyDenominationCounts,
  type OrderCashierState,
} from "@/features/invoices/components/OrderCashierSection";
import { OrderHeaderSection } from "@/features/invoices/components/OrderHeaderSection";
import { OrderLineModal } from "@/features/invoices/components/OrderLineModal";
import { OrderLinesTable } from "@/features/invoices/components/OrderLinesTable";
import { OrderPaymentSection, type OrderPaymentState } from "@/features/invoices/components/OrderPaymentSection";
import {
  draftLineSubtotal,
  draftLineToItems,
  isDraftLineValid,
  type DraftLine,
} from "@/features/invoices/lib/order-draft";
import { useAppSettings } from "@/hooks/use-app-settings";
import { formatMoney } from "@/lib/format-money";
import { pushFlashMessage } from "@/lib/flash-message";
import type { CreateInvoiceItemPayload } from "@/types/invoice";

/**
 * Formulario de nuevo pedido: encabezado compacto, líneas en tabla/modal,
 * resumen del pedido y cobro integrado.
 *
 * @returns Página de alta de pedido.
 */
export function InvoiceNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const appSettings = useAppSettings();
  const clientsQuery = useQuery({ queryKey: ["clients", "list"], queryFn: fetchClients });
  const categoriesQuery = useQuery({ queryKey: ["categories", "active"], queryFn: () => fetchCategories(true) });
  const formatsQuery = useQuery({ queryKey: ["formats"], queryFn: fetchFormats });
  const pricesQuery = useQuery({ queryKey: ["prices", "active"], queryFn: () => fetchPrices(false) });
  const categoryServicesQuery = useQuery({
    queryKey: ["category-services"],
    queryFn: fetchCategoryServices,
  });
  const categoryFinishesQuery = useQuery({
    queryKey: ["category-finishes"],
    queryFn: fetchCategoryFinishes,
  });

  const defaultCategoryId = categoriesQuery.data?.[0]?.id ?? 1;

  const [clientId, setClientId] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [advancePayment, setAdvancePayment] = useState("0");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [payment, setPayment] = useState<OrderPaymentState>(() => ({
    paymentMethod: "efectivo",
    paymentCurrency: "CUP",
    exchangeRate: "",
    transferConcept: "",
  }));
  const [cashier, setCashier] = useState<OrderCashierState>(() => ({
    counts: emptyDenominationCounts(),
    usdCounts: emptyDenominationCounts("USD"),
    amountCup: "",
    amountUsd: "",
    transferConcept: "",
    changeCounts: emptyDenominationCounts(),
  }));

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

  const advanceNum = Number.parseFloat(advancePayment.replace(",", ".")) || 0;
  const orderTotal = Math.max(linesSubtotal - advanceNum, 0);

  const exchangeRate =
    payment.paymentCurrency === "USD" && payment.paymentMethod === "efectivo"
      ? Number.parseFloat(payment.exchangeRate.replace(",", ".")) || appSettings.usdExchangeRate
      : 0;

  const paymentWithRate: OrderPaymentState = payment.exchangeRate
    ? payment
    : { ...payment, exchangeRate: payment.exchangeRate || String(appSettings.usdExchangeRate || "") };

  const linesValid = lines.length > 0 && lines.every(isDraftLineValid);
  const headerValid = clientId > 0;
  const canCheckout = headerValid && linesValid;

  const received = useMemo(
    () => (canCheckout ? computeReceivedAmount(paymentWithRate, cashier, exchangeRate) : 0),
    [canCheckout, paymentWithRate, cashier, exchangeRate],
  );

  const pendingAfterPay = Math.max(orderTotal - received, 0);
  const changePending = useMemo(
    () => (canCheckout ? computeChangePending(received, orderTotal, cashier.changeCounts) : false),
    [canCheckout, received, orderTotal, cashier.changeCounts],
  );

  const saveMutation = useMutation({
    mutationFn: async (collectPayment: boolean) => {
      const items: CreateInvoiceItemPayload[] = lines.flatMap((line) => draftLineToItems(line));

      if (payment.paymentMethod === "efectivo" && payment.paymentCurrency === "USD" && exchangeRate <= 0) {
        throw new Error("Indica una tasa USD→CUP válida.");
      }

      const isUsd = payment.paymentMethod === "efectivo" && payment.paymentCurrency === "USD";
      const isTransfer = payment.paymentMethod === "transferencia";
      const counts = !isUsd && !isTransfer ? buildCountsPayload(cashier.counts) : null;
      const changeCounts = !isTransfer ? buildCountsPayload(cashier.changeCounts) : null;

      const res = await createInvoice({
        clientId,
        date,
        notes: notes.trim() || null,
        advancePayment: advanceNum,
        paid: 0,
        paymentMethod: payment.paymentMethod,
        paymentCurrency: payment.paymentMethod === "transferencia" ? "CUP" : payment.paymentCurrency,
        exchangeRateSnapshot: exchangeRate,
        transferConcept: (cashier.transferConcept || payment.transferConcept).trim() || null,
        initialPayment:
          collectPayment && received > 1e-6
            ? {
                counts,
                amountCup: cashier.amountCup.trim()
                  ? Number.parseFloat(cashier.amountCup.replace(",", "."))
                  : null,
                amountUsd: cashier.amountUsd.trim()
                  ? Number.parseFloat(cashier.amountUsd.replace(",", "."))
                  : null,
                exchangeRate: isUsd ? exchangeRate : null,
                transferConcept: (cashier.transferConcept || payment.transferConcept).trim() || null,
                changeCounts,
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
      pushFlashMessage({ kind: "success", text: `Pedido ${res.invoiceNumber} creado correctamente.` });
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
    if (advanceNum < 0) {
      setFormError("El anticipado no puede ser negativo.");
      return false;
    }
    if (changePending) {
      setFormError(
        "Hay vuelto pendiente por entregar. Cuadra el desglose de billetes del vuelto antes de cobrar.",
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
              (saveMutation.error instanceof Error ? saveMutation.error.message : "Error al guardar el pedido")}
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
                onEdit={openEditLine}
                onRemove={removeLine}
              />
            </div>
          </div>

          <OrderPaymentSection totalCup={orderTotal} value={paymentWithRate} onChange={setPayment} />

          {canCheckout && (
            <div className="transition-all duration-300">
              <OrderCashierSection
                balanceDue={orderTotal}
                payment={paymentWithRate}
                value={cashier}
                exchangeRate={exchangeRate}
                onChange={setCashier}
              />
            </div>
          )}
        </div>

        <div className="card bg-base-100 shadow-sm h-fit lg:sticky lg:top-4">
          <div className="card-body gap-2 p-3 text-sm">
            <h2 className="card-title text-sm">Resumen del pedido</h2>
            <div className="flex justify-between">
              <span>Subtotal líneas</span>
              <span>{formatMoney(linesSubtotal)}</span>
            </div>
            <label className="form-control">
              <span className="label-text text-xs">Anticipado</span>
              <input
                id="inv-advance"
                type="text"
                inputMode="decimal"
                className="input input-bordered input-sm"
                value={advancePayment}
                onChange={(e) => setAdvancePayment(e.target.value)}
              />
            </label>
            <div className="divider my-0" />
            <div className="flex justify-between font-semibold">
              <span>Total pedido</span>
              <span>{formatMoney(orderTotal)}</span>
            </div>
            {canCheckout && received > 0 && (
              <>
                <div className="flex justify-between text-success">
                  <span>Cobro en esta operación</span>
                  <span>{formatMoney(Math.min(received, orderTotal))}</span>
                </div>
                <div className="flex justify-between text-primary">
                  <span>Pendiente</span>
                  <span>{formatMoney(pendingAfterPay)}</span>
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
                {saveMutation.isPending ? <span className="loading loading-spinner loading-sm" /> : "Guardar sin cobrar"}
              </button>
              {canCheckout && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={saveMutation.isPending || received <= 1e-6 || changePending}
                  onClick={() => handleSave(true)}
                >
                  {saveMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm" />
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
        categoryServices={categoryServicesQuery.data ?? []}
        categoryFinishes={categoryFinishesQuery.data ?? []}
        onClose={() => setLineModalOpen(false)}
        onSave={handleSaveLine}
      />
    </section>
  );
}
