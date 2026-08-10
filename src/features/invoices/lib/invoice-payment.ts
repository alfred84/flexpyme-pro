import type { InvoiceHeaderDto, PaymentCurrency, PaymentMethod } from "@/types/invoice";
import {
  emptyOrderPaymentState,
  type OrderPaymentState,
} from "@/features/invoices/components/OrderPaymentSection";

const EPS = 1e-6;

/**
 * Indica si el pedido aún no tiene dinero cobrado (pagado, anticipo o saldo USD pagado).
 *
 * @param inv - Cabecera del pedido.
 * @returns `true` si se puede cambiar la forma de pago.
 */
export function isInvoiceUnpaid(inv: Pick<InvoiceHeaderDto, "paid" | "paidUsd" | "advancePayment">): boolean {
  return (
    (inv.paid ?? 0) <= EPS &&
    (inv.paidUsd ?? 0) <= EPS &&
    (inv.advancePayment ?? 0) <= EPS
  );
}

/**
 * Hidrata el estado de `OrderPaymentSection` desde la cabecera del pedido.
 *
 * @param inv - Cabecera.
 * @param fallbackRate - Tasa de la app si el pedido no tiene snapshot.
 * @returns Estado de pago editable.
 */
export function paymentStateFromInvoice(
  inv: InvoiceHeaderDto,
  fallbackRate = 0,
): OrderPaymentState {
  const rate =
    inv.exchangeRateSnapshot && inv.exchangeRateSnapshot > 0
      ? inv.exchangeRateSnapshot
      : fallbackRate;
  const method = (inv.paymentMethod ?? "efectivo").toLowerCase() as PaymentMethod;
  const rawCurrency = (inv.paymentCurrency ?? "CUP").toLowerCase();
  const currency: PaymentCurrency =
    rawCurrency === "usd" ? "USD" : rawCurrency === "mixto" ? "mixto" : "CUP";
  const base = emptyOrderPaymentState(rate);
  return {
    ...base,
    paymentMethod: method === "transferencia" ? "transferencia" : "efectivo",
    paymentCurrency: method === "transferencia" && currency !== "mixto" ? "CUP" : currency,
    exchangeRate: rate > 0 ? String(rate) : "",
    dueUsd: String(inv.dueUsd ?? 0),
    dueCup: String(inv.dueCup ?? 0),
  };
}
