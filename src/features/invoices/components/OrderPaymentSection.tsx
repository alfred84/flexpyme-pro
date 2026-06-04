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
    <div className="card bg-base-100 shadow">
      <div className="card-body space-y-3">
        <h2 className="card-title text-base">Método de pago</h2>

        <div className="flex flex-wrap gap-2">
          <label className="label cursor-pointer gap-2">
            <input
              type="radio"
              name="payment-method"
              className="radio radio-sm"
              checked={value.paymentMethod === "efectivo"}
              onChange={() => setMethod("efectivo")}
            />
            <span className="label-text">Efectivo</span>
          </label>
          <label className="label cursor-pointer gap-2">
            <input
              type="radio"
              name="payment-method"
              className="radio radio-sm"
              checked={value.paymentMethod === "transferencia"}
              onChange={() => setMethod("transferencia")}
            />
            <span className="label-text">Transferencia</span>
          </label>
        </div>

        {!isTransfer && (
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-base-content/70 w-full">Moneda:</span>
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="payment-currency"
                className="radio radio-sm"
                checked={value.paymentCurrency === "CUP"}
                onChange={() => onChange({ ...value, paymentCurrency: "CUP" })}
              />
              <span className="label-text">CUP</span>
            </label>
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="payment-currency"
                className="radio radio-sm"
                checked={value.paymentCurrency === "USD"}
                onChange={() => onChange({ ...value, paymentCurrency: "USD" })}
              />
              <span className="label-text">USD</span>
            </label>
          </div>
        )}

        {isUsd && (
          <div className="space-y-2 rounded-lg bg-base-200 p-3 text-sm">
            <label className="form-control">
              <span className="label-text">Tasa aplicada (1 USD = CUP)</span>
              <input
                type="number"
                className="input input-bordered input-sm"
                value={value.exchangeRate}
                onChange={(e) => onChange({ ...value, exchangeRate: e.target.value })}
              />
            </label>
            <p>Total en USD: {formatMoney(amountUsd).replace("$", "$ ")} USD</p>
            <p>Total en CUP: {formatMoney(totalCup)}</p>
            <p className="text-xs text-base-content/60">
              Tasa cargada de Configuración; editable solo para este pedido.
            </p>
          </div>
        )}

        {isTransfer && (
          <div className="space-y-2 rounded-lg bg-base-200 p-3 text-sm">
            <p className="text-base-content/70">Solo CUP · Transferencia bancaria</p>
            <label className="form-control">
              <span className="label-text">Concepto / referencia</span>
              <input
                className="input input-bordered input-sm"
                value={value.transferConcept}
                onChange={(e) => onChange({ ...value, transferConcept: e.target.value })}
                placeholder="Nº de operación, banco..."
              />
            </label>
          </div>
        )}

        {!isUsd && !isTransfer && (
          <p className="text-sm">Total a pagar: {formatMoney(totalCup)}</p>
        )}
      </div>
    </div>
  );
}
