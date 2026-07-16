import { useMemo } from "react";
import { AlertTriangle, Wallet } from "lucide-react";
import type { OrderPaymentState } from "@/features/invoices/components/OrderPaymentSection";
import { DenominationGrid } from "@/components/cashflow/DenominationGrid";
import { buildCountsPayload, emptyDenominationCounts, sumDenominationCounts } from "@/lib/cash-counts";
import { formatMoney } from "@/lib/format-money";

const EPS = 0.5;

export interface OrderCashierState {
  /** Conteo de billetes CUP recibidos. */
  counts: Record<string, number>;
  /** Conteo de billetes USD recibidos. */
  usdCounts: Record<string, number>;
  amountCup: string;
  amountUsd: string;
  transferConcept: string;
  /** Conteo de billetes CUP entregados como vuelto. */
  changeCounts: Record<string, number>;
}

interface OrderCashierSectionProps {
  balanceDue: number;
  payment: OrderPaymentState;
  value: OrderCashierState;
  exchangeRate: number;
  onChange: (next: OrderCashierState) => void;
}

/**
 * Calcula el monto recibido (en CUP) según método de pago y conteo.
 *
 * @param payment - Estado de método/moneda de pago.
 * @param cashier - Estado del cobro (conteos y montos).
 * @param exchangeRate - Tasa USD→CUP.
 * @returns Importe recibido en CUP.
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
    const direct = Number.parseFloat(cashier.amountUsd.replace(",", ".")) || 0;
    const fromCounts = sumDenominationCounts(cashier.usdCounts, "USD");
    const usd = direct > 0 ? direct : fromCounts;
    return exchangeRate > 0 ? usd * exchangeRate : 0;
  }
  const direct = Number.parseFloat(cashier.amountCup.replace(",", ".")) || 0;
  const fromCounts = sumDenominationCounts(cashier.counts);
  return direct > 0 ? direct : fromCounts;
}

/**
 * Determina si hay vuelto pendiente de cubrir con billetes.
 *
 * Es `true` cuando hay que devolver cambio pero el desglose de billetes de
 * vuelto no coincide con el importe a devolver (bloquea el cobro).
 *
 * @param received - Importe recibido en CUP.
 * @param balanceDue - Saldo del pedido en CUP.
 * @param changeCounts - Conteo de billetes CUP de vuelto.
 * @returns `true` si el vuelto está pendiente/incompleto.
 */
export function computeChangePending(
  received: number,
  balanceDue: number,
  changeCounts: Record<string, number>,
): boolean {
  const changeDue = Math.max(0, received - balanceDue);
  if (changeDue <= EPS) {
    return false;
  }
  const changeCovered = sumDenominationCounts(changeCounts);
  return Math.abs(changeCovered - changeDue) > EPS;
}

/**
 * Sección de cobro integrada en el alta de pedido, con cuadrículas de
 * denominaciones (CUP/USD), cálculo de vuelto y validación de vuelto pendiente.
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
  const changeCovered = sumDenominationCounts(value.changeCounts);
  const changePending = changeDue > EPS && Math.abs(changeCovered - changeDue) > EPS;

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
          <>
            <DenominationGrid
              currency="USD"
              counts={value.usdCounts}
              onChange={(usdCounts) => onChange({ ...value, usdCounts })}
              label="Conteo de billetes USD o monto total:"
            />
            <label className="form-control">
              <span className="label-text text-xs">O monto total USD</span>
              <input
                className="input input-bordered input-sm"
                inputMode="decimal"
                value={value.amountUsd}
                onChange={(e) => onChange({ ...value, amountUsd: e.target.value })}
              />
            </label>
          </>
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

        {!isTransfer && changeDue > EPS && (
          <div className="space-y-1 rounded-lg bg-base-200 p-2">
            <DenominationGrid
              currency="CUP"
              counts={value.changeCounts}
              onChange={(changeCounts) => onChange({ ...value, changeCounts })}
              label="Vuelto entregado (billetes CUP):"
            />
            {changePending ? (
              <p className="flex items-center gap-1 text-xs text-warning">
                <AlertTriangle className="h-3 w-3" />
                Falta cubrir el vuelto: entrega {formatMoney(changeDue)} en billetes (llevas{" "}
                {formatMoney(changeCovered)}). No se puede cobrar hasta cuadrar el vuelto.
              </p>
            ) : (
              <p className="text-xs text-success">Vuelto cuadrado.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { buildCountsPayload, emptyDenominationCounts };
