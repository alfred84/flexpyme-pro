import { useMemo } from "react";
import { Wallet } from "lucide-react";
import type { OrderPaymentState } from "@/features/invoices/components/OrderPaymentSection";
import { DenominationGrid } from "@/components/cashflow/DenominationGrid";
import { buildCountsPayload, emptyDenominationCounts, sumDenominationCounts } from "@/lib/cash-counts";
import { formatMoney } from "@/lib/format-money";

export interface OrderCashierState {
  counts: Record<string, number>;
  amountCup: string;
  amountUsd: string;
  transferConcept: string;
}

interface OrderCashierSectionProps {
  balanceDue: number;
  payment: OrderPaymentState;
  value: OrderCashierState;
  exchangeRate: number;
  onChange: (next: OrderCashierState) => void;
}

/**
 * Calcula el monto recibido según método de pago y conteo.
 */
export function computeReceivedAmount(
  payment: OrderPaymentState,
  cashier: OrderCashierState,
  exchangeRate: number,
): number {
  const isTransfer = payment.paymentMethod === "transferencia";
  const isUsd = !isTransfer && payment.paymentCurrency === "USD";

  if (isTransfer) {
    return Number.parseFloat(cashier.amountCup.replace(",", ".")) || 0;
  }
  if (isUsd) {
    const usd = Number.parseFloat(cashier.amountUsd.replace(",", ".")) || 0;
    return exchangeRate > 0 ? usd * exchangeRate : 0;
  }
  const direct = Number.parseFloat(cashier.amountCup.replace(",", ".")) || 0;
  const fromCounts = sumDenominationCounts(cashier.counts);
  return direct > 0 ? direct : fromCounts;
}

/**
 * Sección de cobro integrada en el alta de pedido.
 *
 * @param props - Saldo pendiente, pago y estado del conteo.
 * @returns Bloque de cobro inline.
 */
export function OrderCashierSection(props: OrderCashierSectionProps) {
  const { balanceDue, payment, value, exchangeRate, onChange } = props;
  const isTransfer = payment.paymentMethod === "transferencia";
  const isUsd = !isTransfer && payment.paymentCurrency === "USD";

  const received = useMemo(
    () => computeReceivedAmount(payment, value, exchangeRate),
    [payment, value, exchangeRate],
  );
  const changeDue = Math.max(0, received - balanceDue);
  const applied = Math.min(received, balanceDue);

  return (
    <div className="card bg-base-100 shadow-sm border border-primary/20">
      <div className="card-body gap-3 p-3">
        <h2 className="card-title text-sm text-primary">
          <Wallet className="h-4 w-4" />
          Cobrar
        </h2>
        <p className="text-xs text-base-content/60">
          Registra el cobro como parte de esta operación. Pendiente del pedido: {formatMoney(balanceDue)}.
        </p>

        {isTransfer && (
          <>
            <label className="form-control">
              <span className="label-text text-xs">Monto recibido (CUP)</span>
              <input
                className="input input-bordered input-sm"
                inputMode="decimal"
                value={value.amountCup}
                onChange={(e) => onChange({ ...value, amountCup: e.target.value })}
              />
            </label>
            <label className="form-control">
              <span className="label-text text-xs">Referencia / concepto</span>
              <input
                className="input input-bordered input-sm"
                value={value.transferConcept || payment.transferConcept}
                onChange={(e) => onChange({ ...value, transferConcept: e.target.value })}
              />
            </label>
          </>
        )}

        {isUsd && (
          <label className="form-control">
            <span className="label-text text-xs">Monto recibido (USD)</span>
            <input
              className="input input-bordered input-sm"
              inputMode="decimal"
              value={value.amountUsd}
              onChange={(e) => onChange({ ...value, amountUsd: e.target.value })}
            />
          </label>
        )}

        {!isTransfer && !isUsd && (
          <>
            <DenominationGrid
              currency="CUP"
              counts={value.counts}
              onChange={(counts) => onChange({ ...value, counts })}
              label="Conteo de billetes o monto total:"
              hideTotal
            />
            <label className="form-control">
              <span className="label-text text-xs">O monto total CUP</span>
              <input
                className="input input-bordered input-sm"
                inputMode="decimal"
                value={value.amountCup}
                onChange={(e) => onChange({ ...value, amountCup: e.target.value })}
              />
            </label>
          </>
        )}

        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt className="text-base-content/60">Recibido</dt>
            <dd className="font-semibold">{formatMoney(received)}</dd>
          </div>
          <div>
            <dt className="text-base-content/60">Aplica</dt>
            <dd>{formatMoney(applied)}</dd>
          </div>
          <div>
            <dt className="text-base-content/60">Vuelto</dt>
            <dd className="text-secondary">{formatMoney(changeDue)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export { buildCountsPayload, emptyDenominationCounts };
