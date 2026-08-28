import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ModalPortal } from "@/components/common/ModalPortal";
import { DenominationGrid } from "@/components/cashflow/DenominationGrid";
import { fetchInventoryItems, registerInventoryMaterialSale } from "@/db/queries/inventory";
import { formatInventoryMaterialOptionLabel } from "@/features/inventory/lib/inventory-item-label";
import { useAppSettings } from "@/hooks/use-app-settings";
import {
  emptyDenominationCounts,
  serializeSaleDenominationBreakdown,
  sumDenominationCounts,
} from "@/lib/cash-counts";
import { formatMoney } from "@/lib/format-money";
import type { MaterialSalePaymentCurrency } from "@/types/inventory";

interface MaterialSaleModalProps {
  onClose: () => void;
}

type SalePaymentMethod = "efectivo" | "transferencia";

/**
 * Interpreta un importe escrito por el usuario (coma o punto decimal).
 *
 * @param raw - Texto del input.
 * @returns Número finito ≥ 0, o `null` si está vacío o no es válido.
 */
function parseAmountInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const value = Number.parseFloat(trimmed.replace(",", "."));
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

/**
 * Venta de material: descuenta inventario e ingresa el cobro en flujo de caja.
 * Soporta efectivo USD/CUP/mixto y transferencia en CUP.
 *
 * @param props - Callback al cerrar.
 * @returns Modal de venta de material.
 */
export function MaterialSaleModal(props: MaterialSaleModalProps) {
  const { onClose } = props;
  const queryClient = useQueryClient();
  const settings = useAppSettings();
  const itemsQuery = useQuery({ queryKey: ["inventory", "list"], queryFn: fetchInventoryItems });

  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>("efectivo");
  const [paymentCurrency, setPaymentCurrency] = useState<MaterialSalePaymentCurrency>("USD");
  const [amountCup, setAmountCup] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [exchangeRate, setExchangeRate] = useState(String(settings.usdExchangeRate || ""));
  const [transferConcept, setTransferConcept] = useState("");
  const [notes, setNotes] = useState("");
  const [cupCounts, setCupCounts] = useState<Record<string, number>>(() =>
    emptyDenominationCounts("CUP"),
  );
  const [usdCounts, setUsdCounts] = useState<Record<string, number>>(() =>
    emptyDenominationCounts("USD"),
  );
  const [error, setError] = useState<string | null>(null);

  const isCash = paymentMethod === "efectivo";
  const isTransfer = paymentMethod === "transferencia";
  const effectiveCurrency: MaterialSalePaymentCurrency = isTransfer ? "CUP" : paymentCurrency;
  const showsUsd = !isTransfer && (effectiveCurrency === "USD" || effectiveCurrency === "mixto");
  const showsCup = isTransfer || effectiveCurrency === "CUP" || effectiveCurrency === "mixto";
  const showsRate = showsUsd;

  const selectedItem = useMemo(() => {
    const id = Number.parseInt(itemId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return null;
    }
    return (itemsQuery.data ?? []).find((item) => item.id === id) ?? null;
  }, [itemId, itemsQuery.data]);

  const mutation = useMutation({
    mutationFn: registerInventoryMaterialSale,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["cashflow"] }),
      ]);
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "No se pudo registrar la venta");
    },
  });

  const setMethod = (next: SalePaymentMethod) => {
    setPaymentMethod(next);
    if (next === "transferencia") {
      setPaymentCurrency("CUP");
      setAmountUsd("");
      setUsdCounts(emptyDenominationCounts("USD"));
    }
  };

  const setCurrency = (next: MaterialSalePaymentCurrency) => {
    setPaymentCurrency(next);
    if (next === "USD") {
      setAmountCup("");
      setCupCounts(emptyDenominationCounts("CUP"));
    } else if (next === "CUP") {
      setAmountUsd("");
      setUsdCounts(emptyDenominationCounts("USD"));
    }
  };

  const handleUsdCountsChange = (next: Record<string, number>) => {
    setUsdCounts(next);
    setAmountUsd(String(sumDenominationCounts(next, "USD")));
  };

  const handleCupCountsChange = (next: Record<string, number>) => {
    setCupCounts(next);
    setAmountCup(String(sumDenominationCounts(next, "CUP")));
  };

  const handleSubmit = () => {
    setError(null);
    const id = Number.parseInt(itemId, 10);
    const qty = Number.parseFloat(quantity.replace(",", "."));
    if (!Number.isFinite(id) || id <= 0) {
      setError("Selecciona un material.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("La cantidad debe ser mayor que cero.");
      return;
    }
    if (selectedItem && qty > selectedItem.quantity + 1e-9) {
      setError(
        `Stock insuficiente de «${selectedItem.name}»: disponible ${selectedItem.quantity} ${selectedItem.unit}.`,
      );
      return;
    }

    const cupValue = parseAmountInput(amountCup) ?? 0;
    const usdValue = parseAmountInput(amountUsd) ?? 0;
    const rate = parseAmountInput(exchangeRate) ?? 0;

    if (isTransfer) {
      if (cupValue <= 0) {
        setError("Indica el importe CUP de la transferencia.");
        return;
      }
    } else if (effectiveCurrency === "USD") {
      if (usdValue <= 0) {
        setError("Indica el importe USD de la venta.");
        return;
      }
      if (rate <= 0) {
        setError("Indica una tasa USD→CUP válida (auditoría).");
        return;
      }
    } else if (effectiveCurrency === "CUP") {
      if (cupValue <= 0) {
        setError("Indica el importe CUP de la venta.");
        return;
      }
    } else if (cupValue <= 0 || usdValue <= 0) {
      setError("El cobro mixto requiere importes en CUP y en USD mayores que cero.");
      return;
    } else if (rate <= 0) {
      setError("Indica una tasa USD→CUP válida (auditoría).");
      return;
    }

    const denominationBreakdown = isCash
      ? serializeSaleDenominationBreakdown(effectiveCurrency, cupCounts, usdCounts)
      : null;

    void mutation.mutateAsync({
      inventoryItemId: id,
      quantity: qty,
      paymentMethod,
      paymentCurrency: effectiveCurrency,
      amountCup: isTransfer || effectiveCurrency !== "USD" ? cupValue : 0,
      amountUsd: !isTransfer && effectiveCurrency !== "CUP" ? usdValue : 0,
      exchangeRate: showsRate ? rate : 0,
      denominationBreakdown,
      transferConcept: isTransfer ? transferConcept.trim() || null : null,
      notes: notes.trim() || null,
    });
  };

  const qtyNumber = Number.parseFloat(quantity.replace(",", ".")) || 0;
  const impliedUsd = qtyNumber > 0 && showsUsd ? (parseAmountInput(amountUsd) ?? 0) / qtyNumber : 0;
  const impliedCup = qtyNumber > 0 && showsCup ? (parseAmountInput(amountCup) ?? 0) / qtyNumber : 0;

  return (
    <ModalPortal>
      <dialog className="modal modal-open">
        <div className="modal-box max-h-[90vh] max-w-2xl overflow-y-auto">
          <h3 className="text-lg font-bold">Venta de material</h3>
          <p className="mt-1 text-sm text-base-content/70">
            Descuenta el material del inventario y registra un ingreso en Flujo de caja. No crea
            pedido ni factura. Los cajones USD y CUP son independientes; la tasa es solo para
            auditoría.
          </p>

          <div className="mt-4 space-y-3">
            <label className="form-control">
              <span className="label-text">Material *</span>
              <select
                className="select select-bordered"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {(itemsQuery.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatInventoryMaterialOptionLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            {selectedItem && (selectedItem.costPerUnit > 0 || selectedItem.costPerUnitUsd > 0) && (
              <p className="text-xs text-base-content/60">
                Costo de referencia (no es el precio de venta):{" "}
                {selectedItem.costPerUnitUsd > 0
                  ? formatMoney(selectedItem.costPerUnitUsd, "USD")
                  : null}
                {selectedItem.costPerUnitUsd > 0 && selectedItem.costPerUnit > 0 ? " · " : null}
                {selectedItem.costPerUnit > 0 ? formatMoney(selectedItem.costPerUnit, "CUP") : null}
              </p>
            )}

            <label className="form-control">
              <span className="label-text">
                Cantidad *{selectedItem ? ` (${selectedItem.unit})` : ""}
              </span>
              <input
                className="input input-bordered"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">Forma de pago</span>
              <div className="join">
                <button
                  type="button"
                  className={`btn btn-xs join-item ${isCash ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setMethod("efectivo")}
                >
                  Efectivo
                </button>
                <button
                  type="button"
                  className={`btn btn-xs join-item ${isTransfer ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setMethod("transferencia")}
                >
                  Transferencia
                </button>
              </div>
            </div>

            {!isTransfer && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">Moneda</span>
                <div className="join">
                  <button
                    type="button"
                    className={`btn btn-xs join-item ${
                      paymentCurrency === "USD" ? "btn-secondary" : "btn-ghost"
                    }`}
                    onClick={() => setCurrency("USD")}
                  >
                    USD
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs join-item ${
                      paymentCurrency === "CUP" ? "btn-secondary" : "btn-ghost"
                    }`}
                    onClick={() => setCurrency("CUP")}
                  >
                    CUP
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs join-item ${
                      paymentCurrency === "mixto" ? "btn-secondary" : "btn-ghost"
                    }`}
                    onClick={() => setCurrency("mixto")}
                  >
                    Mixto
                  </button>
                </div>
              </div>
            )}

            {isTransfer && (
              <p className="text-xs text-base-content/60">
                La transferencia se registra en CUP, igual que en caja.
              </p>
            )}

            {showsUsd && (
              <label className="form-control">
                <span className="label-text">Importe de venta (USD) *</span>
                <input
                  className="input input-bordered"
                  inputMode="decimal"
                  value={amountUsd}
                  onChange={(e) => setAmountUsd(e.target.value)}
                />
              </label>
            )}

            {showsCup && (
              <label className="form-control">
                <span className="label-text">Importe de venta (CUP) *</span>
                <input
                  className="input input-bordered"
                  inputMode="decimal"
                  value={amountCup}
                  onChange={(e) => setAmountCup(e.target.value)}
                />
              </label>
            )}

            {qtyNumber > 0 && (impliedUsd > 0 || impliedCup > 0) && (
              <p className="text-xs text-base-content/60">
                Precio unitario implícito:{" "}
                {impliedUsd > 0 ? formatMoney(impliedUsd, "USD") : null}
                {impliedUsd > 0 && impliedCup > 0 ? " · " : null}
                {impliedCup > 0 ? formatMoney(impliedCup, "CUP") : null}
              </p>
            )}

            {showsRate && (
              <label className="form-control">
                <span className="label-text">Tasa USD → CUP (auditoría) *</span>
                <input
                  className="input input-bordered"
                  inputMode="decimal"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                />
              </label>
            )}

            {isTransfer && (
              <label className="form-control">
                <span className="label-text">Concepto / referencia de transferencia</span>
                <input
                  className="input input-bordered"
                  value={transferConcept}
                  onChange={(e) => setTransferConcept(e.target.value)}
                  placeholder="Opcional"
                />
              </label>
            )}

            {isCash && showsUsd && (
              <div className="rounded-lg border border-base-300 p-3">
                <DenominationGrid
                  currency="USD"
                  counts={usdCounts}
                  onChange={handleUsdCountsChange}
                  label="Desglose efectivo USD (opcional, actualiza el importe)"
                />
              </div>
            )}

            {isCash && showsCup && (
              <div className="rounded-lg border border-base-300 p-3">
                <DenominationGrid
                  currency="CUP"
                  counts={cupCounts}
                  onChange={handleCupCountsChange}
                  label="Desglose efectivo CUP (opcional, actualiza el importe)"
                />
              </div>
            )}

            <label className="form-control">
              <span className="label-text">Notas</span>
              <textarea
                className="textarea textarea-bordered"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>

          {error && <p className="mt-2 text-sm text-error">{error}</p>}
          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-success"
              disabled={mutation.isPending}
              onClick={handleSubmit}
            >
              {mutation.isPending ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                "Registrar venta"
              )}
            </button>
          </div>
        </div>
        <button
          type="button"
          className="modal-backdrop bg-transparent"
          aria-label="Cerrar"
          onClick={onClose}
        />
      </dialog>
    </ModalPortal>
  );
}
