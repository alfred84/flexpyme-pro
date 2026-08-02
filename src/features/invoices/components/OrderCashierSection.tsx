import { useMemo } from "react";
import { AlertTriangle, Wallet } from "lucide-react";
import type { OrderPaymentState } from "@/features/invoices/components/OrderPaymentSection";
import { DenominationGrid } from "@/components/cashflow/DenominationGrid";
import { buildCountsPayload, emptyDenominationCounts, sumDenominationCounts } from "@/lib/cash-counts";
import { formatMoney } from "@/lib/format-money";
import type { OverpaymentDisposition } from "@/types/invoice";

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
  /** Disposición del exceso: vuelto o saldo a favor. */
  overpaymentDisposition: OverpaymentDisposition;
  /** Aplicar saldo a favor disponible del cliente. */
  applyClientCredit: boolean;
}

interface OrderCashierSectionProps {
  balanceDue: number;
  payment: OrderPaymentState;
  value: OrderCashierState;
  exchangeRate: number;
  /** Crédito disponible del cliente (antes de aplicar). */
  clientCreditBalance?: number;
  onChange: (next: OrderCashierState) => void;
  /** Título del bloque (Cobrar / Anticipo). */
  title?: string;
  /** Texto de ayuda bajo el título. */
  hint?: string;
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
 * Importe USD recibido (directo o desde conteo).
 *
 * @param cashier - Estado del cobro.
 * @returns Monto USD.
 */
export function computeReceivedUsd(cashier: OrderCashierState): number {
  const direct = Number.parseFloat(cashier.amountUsd.replace(",", ".")) || 0;
  const fromCounts = sumDenominationCounts(cashier.usdCounts, "USD");
  return direct > 0 ? direct : fromCounts;
}

/**
 * Determina si hay vuelto pendiente de cubrir con billetes.
 * Con disposición «credit» nunca bloquea.
 *
 * @param received - Importe recibido en CUP.
 * @param balanceDue - Saldo del pedido en CUP.
 * @param changeCounts - Conteo de billetes CUP de vuelto.
 * @param disposition - Disposición del exceso.
 * @returns `true` si el vuelto está pendiente/incompleto.
 */
export function computeChangePending(
  received: number,
  balanceDue: number,
  changeCounts: Record<string, number>,
  disposition: OverpaymentDisposition = "change",
): boolean {
  if (disposition === "credit") {
    return false;
  }
  const changeDue = Math.max(0, received - balanceDue);
  if (changeDue <= EPS) {
    return false;
  }
  const changeCovered = sumDenominationCounts(changeCounts);
  return Math.abs(changeCovered - changeDue) > EPS;
}

/**
 * Estado inicial vacío del cobro/anticipo.
 *
 * @returns Estado por defecto.
 */
export function emptyOrderCashierState(): OrderCashierState {
  return {
    counts: emptyDenominationCounts(),
    usdCounts: emptyDenominationCounts("USD"),
    amountCup: "",
    amountUsd: "",
    transferConcept: "",
    changeCounts: emptyDenominationCounts(),
    overpaymentDisposition: "change",
    applyClientCredit: true,
  };
}

/**
 * Sección de cobro/anticipo con denominaciones, vuelto opcional y saldo a favor.
 *
 * @param props - Saldo pendiente, pago y estado del conteo.
 * @returns Bloque de cobro inline.
 */
export function OrderCashierSection(props: OrderCashierSectionProps) {
  const {
    balanceDue,
    payment,
    value,
    exchangeRate,
    clientCreditBalance = 0,
    onChange,
    title = "Cobrar",
    hint,
  } = props;
  const isTransfer = payment.paymentMethod === "transferencia";
  const isUsd = !isTransfer && payment.paymentCurrency === "USD";

  const creditApplied = value.applyClientCredit
    ? Math.min(clientCreditBalance, Math.max(0, balanceDue))
    : 0;
  const effectiveDue = Math.max(0, balanceDue - creditApplied);

  const received = useMemo(
    () => computeReceivedAmount(payment, value, exchangeRate),
    [payment, value, exchangeRate],
  );
  const changeDue =
    value.overpaymentDisposition === "change" ? Math.max(0, received - effectiveDue) : 0;
  const creditToAdd =
    value.overpaymentDisposition === "credit" ? Math.max(0, received - effectiveDue) : 0;
  const applied = Math.min(received, effectiveDue);
  const changeCovered = sumDenominationCounts(value.changeCounts);
  const changePending =
    value.overpaymentDisposition === "change" &&
    changeDue > EPS &&
    Math.abs(changeCovered - changeDue) > EPS;

  return (
    <div className="card bg-base-100 shadow-sm border border-primary/20">
      <div className="card-body gap-3 p-3">
        <h2 className="card-title text-sm text-primary">
          <Wallet className="h-4 w-4" />
          {title}
        </h2>
        <p className="text-xs text-base-content/60">
          {hint ??
            `Registra el cobro como parte de esta operación. Pendiente del pedido: ${formatMoney(balanceDue)}.`}
        </p>

        {clientCreditBalance > EPS && (
          <label className="label cursor-pointer justify-start gap-2 py-0">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary"
              checked={value.applyClientCredit}
              onChange={(e) => onChange({ ...value, applyClientCredit: e.target.checked })}
            />
            <span className="label-text text-xs">
              Aplicar saldo a favor ({formatMoney(clientCreditBalance)})
              {creditApplied > EPS ? ` → −${formatMoney(creditApplied)}` : ""}
            </span>
          </label>
        )}

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
            <dt className="text-base-content/60">Pendiente</dt>
            <dd className="font-semibold">{formatMoney(effectiveDue)}</dd>
          </div>
          <div>
            <dt className="text-base-content/60">Recibido</dt>
            <dd className="font-semibold">{formatMoney(received)}</dd>
          </div>
          <div>
            <dt className="text-base-content/60">Aplica</dt>
            <dd>{formatMoney(applied)}</dd>
          </div>
        </dl>

        {received - effectiveDue > EPS && (
          <div className="space-y-2 rounded-lg bg-base-200 p-2">
            <p className="text-xs font-medium">
              Exceso: {formatMoney(received - effectiveDue)}. ¿Qué hacer?
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <label className="label cursor-pointer gap-2 py-0">
                <input
                  type="radio"
                  className="radio radio-xs radio-primary"
                  name="overpay-disposition"
                  checked={value.overpaymentDisposition === "change"}
                  onChange={() => onChange({ ...value, overpaymentDisposition: "change" })}
                />
                <span className="label-text text-xs">Devolver vuelto</span>
              </label>
              <label className="label cursor-pointer gap-2 py-0">
                <input
                  type="radio"
                  className="radio radio-xs radio-primary"
                  name="overpay-disposition"
                  checked={value.overpaymentDisposition === "credit"}
                  onChange={() => onChange({ ...value, overpaymentDisposition: "credit" })}
                />
                <span className="label-text text-xs">Dejar saldo a favor</span>
              </label>
            </div>

            {value.overpaymentDisposition === "credit" && (
              <p className="text-xs text-success">
                Se acreditarán {formatMoney(creditToAdd)} al saldo a favor del cliente. El dinero
                permanece en caja.
              </p>
            )}

            {!isTransfer && value.overpaymentDisposition === "change" && (
              <>
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
                    {formatMoney(changeCovered)}).
                  </p>
                ) : (
                  <p className="text-xs text-success">Vuelto cuadrado.</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { buildCountsPayload, emptyDenominationCounts };
