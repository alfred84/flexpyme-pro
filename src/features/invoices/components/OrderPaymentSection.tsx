import { useMemo } from "react";
import { formatAmount } from "@/lib/format-money";
import type { PaymentCurrency, PaymentMethod } from "@/types/invoice";

const EPS = 0.5;

export interface OrderPaymentState {
  paymentMethod: PaymentMethod;
  paymentCurrency: PaymentCurrency;
  exchangeRate: string;
  transferConcept: string;
  /** Parte del total a cobrar en USD (modo Mixto o puro USD). */
  dueUsd: string;
  /** Parte del total a cobrar en CUP (modo Mixto o puro CUP). */
  dueCup: string;
}

interface OrderPaymentSectionProps {
  totalCup: number;
  /** Total en USD del pedido (suma de precios USD × cantidades). */
  totalUsd?: number;
  value: OrderPaymentState;
  onChange: (next: OrderPaymentState) => void;
  /** Título del bloque (anticipo / saldo / cobro). */
  title?: string;
  /** Callback al cambiar la tasa (para recalcular líneas del borrador). */
  onExchangeRateCommit?: (rate: number) => void;
}

/**
 * Estado inicial de pago del pedido.
 *
 * @param rate - Tasa USD→CUP inicial.
 * @returns Estado por defecto (efectivo USD).
 */
export function emptyOrderPaymentState(rate = 0): OrderPaymentState {
  return {
    paymentMethod: "efectivo",
    paymentCurrency: "USD",
    exchangeRate: rate > 0 ? String(rate) : "",
    transferConcept: "",
    dueUsd: "",
    dueCup: "",
  };
}

/**
 * Resuelve due_usd / due_cup según moneda del pedido y totales.
 *
 * @param currency - Moneda de cobro del pedido.
 * @param totalUsd - Total USD de líneas.
 * @param totalCup - Total CUP de líneas.
 * @param dueUsdRaw - Split Mixto declarado (USD).
 * @param dueCupRaw - Split Mixto declarado (CUP).
 * @returns Par due en números.
 */
export function resolveDueSplit(
  currency: PaymentCurrency,
  totalUsd: number,
  totalCup: number,
  dueUsdRaw: string,
  dueCupRaw: string,
): { dueUsd: number; dueCup: number } {
  if (currency === "USD") {
    return { dueUsd: Math.max(0, totalUsd), dueCup: 0 };
  }
  if (currency === "CUP") {
    return { dueUsd: 0, dueCup: Math.max(0, totalCup) };
  }
  const dueUsd = Number.parseFloat(dueUsdRaw.replace(",", ".")) || 0;
  const dueCup = Number.parseFloat(dueCupRaw.replace(",", ".")) || 0;
  return { dueUsd: Math.max(0, dueUsd), dueCup: Math.max(0, dueCup) };
}

/**
 * Valida que el split Mixto cuadre con el total CUP a la tasa dada.
 *
 * @param dueUsd - Parte USD.
 * @param dueCup - Parte CUP.
 * @param rate - Tasa del pedido.
 * @param totalCup - Total CUP.
 * @returns `true` si cuadra dentro de tolerancia.
 */
export function isMixtoSplitValid(
  dueUsd: number,
  dueCup: number,
  rate: number,
  totalCup: number,
): boolean {
  if (!(rate > 0)) {
    return false;
  }
  const equiv = dueUsd * rate + dueCup;
  return Math.abs(equiv - totalCup) <= EPS;
}

/**
 * Sección de método de pago y moneda en el formulario de pedido.
 *
 * Soporta USD / CUP / Mixto. La tasa editable aparece en CUP y Mixto.
 * En Mixto se declara el split `due_usd` + `due_cup`.
 *
 * @param props - Totales y estado controlado del pago.
 * @returns Bloque de UI para capturar forma de pago.
 */
export function OrderPaymentSection(props: OrderPaymentSectionProps) {
  const {
    totalCup,
    totalUsd: totalUsdProp,
    value,
    onChange,
    title = "Método de pago",
    onExchangeRateCommit,
  } = props;

  const rate = Number(value.exchangeRate.replace(",", ".")) || 0;
  const isTransfer = value.paymentMethod === "transferencia";
  const isUsd = !isTransfer && value.paymentCurrency === "USD";
  const isMixto = !isTransfer && value.paymentCurrency === "mixto";
  /** Cobro en CUP o Mixto: tasa editable. */
  const showsRate = isTransfer || value.paymentCurrency === "CUP" || isMixto;
  const amountUsd = useMemo(
    () =>
      totalUsdProp != null && Number.isFinite(totalUsdProp)
        ? totalUsdProp
        : rate > 0
          ? totalCup / rate
          : 0,
    [rate, totalCup, totalUsdProp],
  );

  const mixtoDue = resolveDueSplit(
    "mixto",
    amountUsd,
    totalCup,
    value.dueUsd,
    value.dueCup,
  );
  const mixtoOk =
    !isMixto || isMixtoSplitValid(mixtoDue.dueUsd, mixtoDue.dueCup, rate, totalCup);

  const setMethod = (paymentMethod: PaymentMethod) => {
    const next: OrderPaymentState = { ...value, paymentMethod };
    if (paymentMethod === "transferencia") {
      next.paymentCurrency = "CUP";
      next.dueUsd = "0";
      next.dueCup = String(totalCup);
    }
    onChange(next);
  };

  const setCurrency = (paymentCurrency: PaymentCurrency) => {
    const next: OrderPaymentState = { ...value, paymentCurrency };
    if (paymentCurrency === "USD") {
      next.dueUsd = String(amountUsd);
      next.dueCup = "0";
    } else if (paymentCurrency === "CUP") {
      next.dueUsd = "0";
      next.dueCup = String(totalCup);
    } else if (!next.dueUsd && !next.dueCup) {
      next.dueUsd = String(amountUsd / 2);
      next.dueCup = rate > 0 ? String(totalCup - (amountUsd / 2) * rate) : String(totalCup / 2);
    }
    onChange(next);
  };

  const setRate = (exchangeRate: string) => {
    const next = { ...value, exchangeRate };
    onChange(next);
    const n = Number.parseFloat(exchangeRate.replace(",", ".")) || 0;
    if (n > 0 && onExchangeRateCommit) {
      onExchangeRateCommit(n);
    }
  };

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title text-sm">{title}</h2>
          <div className="join">
            <button
              type="button"
              className={`btn btn-xs join-item ${value.paymentMethod === "efectivo" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setMethod("efectivo")}
            >
              Efectivo
            </button>
            <button
              type="button"
              className={`btn btn-xs join-item ${value.paymentMethod === "transferencia" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setMethod("transferencia")}
            >
              Transferencia
            </button>
          </div>
        </div>

        {!isTransfer && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-base-content/70">Moneda</span>
            <div className="join">
              <button
                type="button"
                className={`btn btn-xs join-item ${value.paymentCurrency === "USD" ? "btn-secondary" : "btn-ghost"}`}
                onClick={() => setCurrency("USD")}
              >
                USD
              </button>
              <button
                type="button"
                className={`btn btn-xs join-item ${value.paymentCurrency === "CUP" ? "btn-secondary" : "btn-ghost"}`}
                onClick={() => setCurrency("CUP")}
              >
                CUP
              </button>
              <button
                type="button"
                className={`btn btn-xs join-item ${value.paymentCurrency === "mixto" ? "btn-secondary" : "btn-ghost"}`}
                onClick={() => setCurrency("mixto")}
              >
                Mixto
              </button>
            </div>
          </div>
        )}

        {showsRate && (
          <div className="space-y-1 rounded-lg bg-base-200 p-2 text-xs">
            <label className="form-control">
              <span className="label-text text-xs">Tasa aplicada (1 USD = CUP)</span>
              <input
                type="number"
                className="input input-bordered input-xs"
                value={value.exchangeRate}
                onChange={(e) => setRate(e.target.value)}
              />
            </label>
            <p className="text-base-content/60">
              Los precios de venta están en USD; esta tasa convierte el total a CUP.
            </p>
            <div className="flex justify-between">
              <span>Total USD</span>
              <span>{formatAmount(amountUsd)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total CUP</span>
              <span>{formatAmount(totalCup)}</span>
            </div>
          </div>
        )}

        {isUsd && (
          <div className="rounded-lg bg-base-200 p-2 text-xs">
            <div className="flex justify-between">
              <span>Total a cobrar (USD)</span>
              <span className="font-semibold">{formatAmount(amountUsd)}</span>
            </div>
          </div>
        )}

        {isMixto && (
          <div className="space-y-2 rounded-lg bg-base-200 p-2 text-xs">
            <p className="font-medium">Split del cobro</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="form-control">
                <span className="label-text text-xs">Due USD</span>
                <input
                  type="number"
                  className="input input-bordered input-xs"
                  value={value.dueUsd}
                  onChange={(e) => onChange({ ...value, dueUsd: e.target.value })}
                />
              </label>
              <label className="form-control">
                <span className="label-text text-xs">Due CUP</span>
                <input
                  type="number"
                  className="input input-bordered input-xs"
                  value={value.dueCup}
                  onChange={(e) => onChange({ ...value, dueCup: e.target.value })}
                />
              </label>
            </div>
            {rate > 0 && (
              <p className={mixtoOk ? "text-success" : "text-warning"}>
                Equivalente: {formatAmount(mixtoDue.dueUsd * rate + mixtoDue.dueCup)} CUP
                {mixtoOk ? " (cuadra)" : ` — debe ≈ ${formatAmount(totalCup)} CUP`}
              </p>
            )}
          </div>
        )}

        {isTransfer && (
          <label className="form-control">
            <span className="label-text text-xs">Concepto / referencia</span>
            <input
              className="input input-bordered input-sm"
              value={value.transferConcept}
              onChange={(e) => onChange({ ...value, transferConcept: e.target.value })}
            />
          </label>
        )}
      </div>
    </div>
  );
}
