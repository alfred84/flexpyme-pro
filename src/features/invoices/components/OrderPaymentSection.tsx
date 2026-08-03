import { useMemo } from "react";
import { formatMoney } from "@/lib/format-money";
import type { PaymentCurrency, PaymentMethod } from "@/types/invoice";

export interface OrderPaymentState {
  paymentMethod: PaymentMethod;
  paymentCurrency: PaymentCurrency;
  exchangeRate: string;
  transferConcept: string;
}

interface OrderPaymentSectionProps {
  totalCup: number;
  value: OrderPaymentState;
  onChange: (next: OrderPaymentState) => void;
}

/**
 * Sección de método de pago y moneda en el formulario de pedido.
 *
 * @param props - Total en CUP y estado controlado del pago.
 * @returns Bloque de UI para capturar forma de pago.
 */
export function OrderPaymentSection(props: OrderPaymentSectionProps) {
  const { totalCup, value, onChange } = props;

  const rate = Number(value.exchangeRate.replace(",", ".")) || 0;
  const isTransfer = value.paymentMethod === "transferencia";
  const isUsd = !isTransfer && value.paymentCurrency === "USD";
  const amountUsd = useMemo(() => (isUsd && rate > 0 ? totalCup / rate : 0), [isUsd, rate, totalCup]);

  const setMethod = (paymentMethod: PaymentMethod) => {
    const next: OrderPaymentState = { ...value, paymentMethod };
    if (paymentMethod === "transferencia") {
      next.paymentCurrency = "CUP";
    }
    onChange(next);
  };

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title text-sm">Método de pago</h2>
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
                onClick={() => onChange({ ...value, paymentCurrency: "USD" })}
              >
                USD
              </button>
              <button
                type="button"
                className={`btn btn-xs join-item ${value.paymentCurrency === "CUP" ? "btn-secondary" : "btn-ghost"}`}
                onClick={() => onChange({ ...value, paymentCurrency: "CUP" })}
              >
                CUP
              </button>
            </div>
          </div>
        )}

        {isUsd && (
          <div className="space-y-1 rounded-lg bg-base-200 p-2 text-xs">
            <label className="form-control">
              <span className="label-text text-xs">Tasa aplicada (1 USD = CUP)</span>
              <input
                type="number"
                className="input input-bordered input-xs"
                value={value.exchangeRate}
                onChange={(e) => onChange({ ...value, exchangeRate: e.target.value })}
              />
            </label>
            <div className="flex justify-between">
              <span>Total USD</span>
              <span>{formatMoney(amountUsd).replace("$", "$ ")} USD</span>
            </div>
            <div className="flex justify-between">
              <span>Total CUP</span>
              <span>{formatMoney(totalCup)}</span>
            </div>
          </div>
        )}

        {isTransfer && (
          <label className="form-control">
            <span className="label-text text-xs">Concepto / referencia</span>
            <input
              className="input input-bordered input-xs"
              value={value.transferConcept}
              onChange={(e) => onChange({ ...value, transferConcept: e.target.value })}
              placeholder="Nº de operación, banco..."
            />
          </label>
        )}

        {!isUsd && (
          <p className="text-right text-xs">
            Total a pagar: <span className="font-semibold">{formatMoney(totalCup)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
