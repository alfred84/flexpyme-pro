import { useMemo } from "react";
import { AlertTriangle, Wallet } from "lucide-react";
import { DualMoneyText } from "@/components/common/DualMoneyText";
import type { OrderPaymentState } from "@/features/invoices/components/OrderPaymentSection";
import { DenominationGrid } from "@/components/cashflow/DenominationGrid";
import { buildCountsPayload, emptyDenominationCounts, sumDenominationCounts } from "@/lib/cash-counts";
import { cupToUsd, type SaleCurrency } from "@/lib/currency";
import { formatMoney, moneyHeading } from "@/lib/format-money";
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
  /** Conteo de billetes USD entregados como vuelto. */
  changeUsdCounts: Record<string, number>;
  /** Disposición del exceso: vuelto o saldo a favor. */
  overpaymentDisposition: OverpaymentDisposition;
  /** Aplicar saldo a favor disponible del cliente. */
  applyClientCredit: boolean;
}

interface OrderCashierSectionProps {
  balanceDue: number;
  /** Saldo pendiente en USD (modo dual / Mixto). */
  balanceDueUsd?: number;
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
 * Importe CUP recibido (conteo de billetes tiene prioridad sobre monto libre).
 * Así se evitan dobles conteos por montos residuales al cambiar de moneda.
 *
 * @param cashier - Estado del cobro.
 * @returns Monto CUP.
 */
export function computeReceivedCup(cashier: OrderCashierState): number {
  const fromCounts = sumDenominationCounts(cashier.counts);
  if (fromCounts > EPS) {
    return fromCounts;
  }
  return Number.parseFloat(cashier.amountCup.replace(",", ".")) || 0;
}

/**
 * Importe USD recibido (conteo de billetes tiene prioridad sobre monto libre).
 *
 * @param cashier - Estado del cobro.
 * @returns Monto USD.
 */
export function computeReceivedUsd(cashier: OrderCashierState): number {
  const fromCounts = sumDenominationCounts(cashier.usdCounts, "USD");
  if (fromCounts > EPS) {
    return fromCounts;
  }
  return Number.parseFloat(cashier.amountUsd.replace(",", ".")) || 0;
}

/**
 * Calcula el monto recibido (equivalente CUP) según método de pago y conteo.
 *
 * @param payment - Estado de método/moneda de pago.
 * @param cashier - Estado del cobro (conteos y montos).
 * @param exchangeRate - Tasa USD→CUP.
 * @returns Importe recibido en CUP equivalente.
 */
export function computeReceivedAmount(
  payment: OrderPaymentState,
  cashier: OrderCashierState,
  exchangeRate: number,
): number {
  const isTransfer = payment.paymentMethod === "transferencia";
  if (isTransfer) {
    return computeReceivedCup(cashier);
  }
  const cup = computeReceivedCup(cashier);
  const usd = computeReceivedUsd(cashier);
  const usdAsCup = exchangeRate > 0 ? usd * exchangeRate : 0;
  return cup + usdAsCup;
}

/**
 * Determina si hay vuelto pendiente de cubrir con billetes (CUP y/o USD).
 * Con disposición «credit» nunca bloquea.
 *
 * @param receivedCupEquiv - Importe recibido en CUP equivalente.
 * @param balanceDue - Saldo del pedido en CUP equivalente.
 * @param changeCounts - Conteo de billetes CUP de vuelto.
 * @param changeUsdCounts - Conteo de billetes USD de vuelto.
 * @param exchangeRate - Tasa del pedido.
 * @param disposition - Disposición del exceso.
 * @returns `true` si el vuelto está pendiente/incompleto.
 */
export function computeChangePending(
  receivedCupEquiv: number,
  balanceDue: number,
  changeCounts: Record<string, number>,
  disposition: OverpaymentDisposition = "change",
  changeUsdCounts: Record<string, number> = emptyDenominationCounts("USD"),
  exchangeRate = 0,
): boolean {
  if (disposition === "credit") {
    return false;
  }
  const changeDue = Math.max(0, receivedCupEquiv - balanceDue);
  if (changeDue <= EPS) {
    return false;
  }
  const changeCup = sumDenominationCounts(changeCounts);
  const changeUsd = sumDenominationCounts(changeUsdCounts, "USD");
  const covered = changeCup + (exchangeRate > 0 ? changeUsd * exchangeRate : 0);
  return Math.abs(covered - changeDue) > EPS;
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
    changeUsdCounts: emptyDenominationCounts("USD"),
    overpaymentDisposition: "change",
    applyClientCredit: true,
  };
}

/**
 * Sección de cobro/anticipo con denominaciones duales, vuelto opcional y saldo a favor.
 *
 * En Mixto (y efectivo) se pueden recibir y devolver billetes en USD y CUP.
 *
 * @param props - Saldo pendiente, pago y estado del conteo.
 * @returns Bloque de cobro inline.
 */
export function OrderCashierSection(props: OrderCashierSectionProps) {
  const {
    balanceDue,
    balanceDueUsd = 0,
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
  const isCup = !isTransfer && payment.paymentCurrency === "CUP";
  const isMixto = !isTransfer && payment.paymentCurrency === "mixto";
  const showCupReceive = isTransfer || isCup || isMixto;
  const showUsdReceive = isUsd || isMixto;
  const primary: SaleCurrency = isUsd ? "USD" : "CUP";

  const creditApplied = value.applyClientCredit
    ? Math.min(clientCreditBalance, Math.max(0, balanceDue))
    : 0;
  const effectiveDue = Math.max(0, balanceDue - creditApplied);

  const received = useMemo(
    () => computeReceivedAmount(payment, value, exchangeRate),
    [payment, value, exchangeRate],
  );
  const receivedCup = computeReceivedCup(value);
  const receivedUsd = computeReceivedUsd(value);

  const changeDue =
    value.overpaymentDisposition === "change" ? Math.max(0, received - effectiveDue) : 0;
  const creditToAdd =
    value.overpaymentDisposition === "credit" ? Math.max(0, received - effectiveDue) : 0;
  const applied = Math.min(received, effectiveDue);
  const changeCupCovered = sumDenominationCounts(value.changeCounts);
  const changeUsdCovered = sumDenominationCounts(value.changeUsdCounts, "USD");
  const changeCoveredEquiv =
    changeCupCovered + (exchangeRate > 0 ? changeUsdCovered * exchangeRate : 0);
  const changePending =
    value.overpaymentDisposition === "change" &&
    changeDue > EPS &&
    Math.abs(changeCoveredEquiv - changeDue) > EPS;

  const pendingHint =
    isUsd && exchangeRate > 0
      ? formatMoney(balanceDueUsd > 0 ? balanceDueUsd : cupToUsd(balanceDue, exchangeRate), "USD")
      : isMixto
        ? `${formatMoney(Math.max(0, balanceDue - balanceDueUsd * (exchangeRate || 0)), "CUP")} + ${formatMoney(balanceDueUsd, "USD")}`
        : formatMoney(balanceDue, "CUP");

  return (
    <div className="card bg-base-100 shadow-sm border border-primary/20">
      <div className="card-body gap-3 p-3">
        <h2 className="card-title text-sm text-primary">
          <Wallet className="h-4 w-4" />
          {title}
        </h2>
        <p className="text-xs text-base-content/60">
          {hint ??
            `Registra el cobro como parte de esta operación. Pendiente del pedido: ${pendingHint}.`}
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
              Aplicar saldo a favor ({formatMoney(clientCreditBalance, "CUP")})
              {creditApplied > EPS ? ` → −${formatMoney(creditApplied, "CUP")}` : ""}
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

        {!isTransfer && showUsdReceive && (
          <>
            <DenominationGrid
              currency="USD"
              counts={value.usdCounts}
              onChange={(usdCounts) =>
                onChange({
                  ...value,
                  usdCounts,
                  // Si hay billetes, el monto libre no debe competir (evita doble conteo).
                  amountUsd:
                    sumDenominationCounts(usdCounts, "USD") > EPS ? "" : value.amountUsd,
                })
              }
              label="Conteo de billetes USD o monto total:"
            />
            <label className="form-control">
              <span className="label-text text-xs">O monto total USD</span>
              <input
                className="input input-bordered input-sm"
                inputMode="decimal"
                value={value.amountUsd}
                onChange={(e) =>
                  onChange({
                    ...value,
                    amountUsd: e.target.value,
                    usdCounts: emptyDenominationCounts("USD"),
                  })
                }
              />
            </label>
          </>
        )}

        {!isTransfer && showCupReceive && (
          <>
            <DenominationGrid
              currency="CUP"
              counts={value.counts}
              onChange={(counts) =>
                onChange({
                  ...value,
                  counts,
                  amountCup: sumDenominationCounts(counts) > EPS ? "" : value.amountCup,
                })
              }
              label="Conteo de billetes CUP o monto total:"
              hideTotal
            />
            <label className="form-control">
              <span className="label-text text-xs">O monto total CUP</span>
              <input
                className="input input-bordered input-sm"
                inputMode="decimal"
                value={value.amountCup}
                onChange={(e) =>
                  onChange({
                    ...value,
                    amountCup: e.target.value,
                    counts: emptyDenominationCounts(),
                  })
                }
              />
            </label>
          </>
        )}

        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt className="text-base-content/60">{moneyHeading("Pendiente", primary)}</dt>
            <dd className="font-semibold">
              <DualMoneyText amountCup={effectiveDue} rate={exchangeRate} primary={primary} />
            </dd>
          </div>
          <div>
            <dt className="text-base-content/60">{moneyHeading("Recibido", primary)}</dt>
            <dd className="font-semibold">
              {isMixto ? (
                <span>
                  {formatMoney(receivedCup, "CUP")}
                  {receivedUsd > 0 ? ` + ${formatMoney(receivedUsd, "USD")}` : ""}
                </span>
              ) : (
                <DualMoneyText amountCup={received} rate={exchangeRate} primary={primary} />
              )}
            </dd>
          </div>
          <div>
            <dt className="text-base-content/60">{moneyHeading("Aplica", primary)}</dt>
            <dd>
              <DualMoneyText amountCup={applied} rate={exchangeRate} primary={primary} />
            </dd>
          </div>
        </dl>

        {received - effectiveDue > EPS && (
          <div className="space-y-2 rounded-lg bg-base-200 p-2">
            <p className="text-xs font-medium">
              Exceso:{" "}
              {isUsd && exchangeRate > 0
                ? formatMoney(cupToUsd(received - effectiveDue, exchangeRate), "USD")
                : formatMoney(received - effectiveDue, "CUP")}
              . ¿Qué hacer?
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
                Se acreditarán {formatMoney(creditToAdd, "CUP")} al saldo a favor del cliente. El
                dinero permanece en caja.
              </p>
            )}

            {!isTransfer && value.overpaymentDisposition === "change" && (
              <>
                {(isCup || isMixto) && (
                  <DenominationGrid
                    currency="CUP"
                    counts={value.changeCounts}
                    onChange={(changeCounts) => onChange({ ...value, changeCounts })}
                    label="Vuelto entregado (billetes CUP):"
                  />
                )}
                {(isUsd || isMixto) && (
                  <DenominationGrid
                    currency="USD"
                    counts={value.changeUsdCounts}
                    onChange={(changeUsdCounts) => onChange({ ...value, changeUsdCounts })}
                    label="Vuelto entregado (billetes USD):"
                  />
                )}
                {changePending ? (
                  <p className="flex items-center gap-1 text-xs text-warning">
                    <AlertTriangle className="h-3 w-3" />
                    Falta cubrir el vuelto: entrega ≈ {formatMoney(changeDue, "CUP")} en billetes
                    (llevas {formatMoney(changeCoveredEquiv, "CUP")}).
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
