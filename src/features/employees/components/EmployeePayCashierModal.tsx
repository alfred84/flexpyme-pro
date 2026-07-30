import { useEffect, useMemo, useState } from "react";
import { ModalPortal } from "@/components/common/ModalPortal";
import { DenominationGrid } from "@/components/cashflow/DenominationGrid";
import {
  buildCountsPayload,
  emptyDenominationCounts,
  sumDenominationCounts,
} from "@/lib/cash-counts";
import { formatMoney } from "@/lib/format-money";
import type { DenominationCurrency } from "@/types/cashier";

export type EmployeePayMethod = "efectivo" | "transferencia";

interface EmployeePayCashierModalProps {
  open: boolean;
  /** Título del modal. */
  title: string;
  /** Monto a pagar en CUP. */
  amountCup: number;
  /** Descripción opcional (lotes incluidos). */
  description?: string;
  onClose: () => void;
  /**
   * Confirma el pago con método, moneda y desglose.
   *
   * @param data - Datos de caja del pago interno.
   */
  onConfirm: (data: {
    paymentMethod: EmployeePayMethod;
    currency: DenominationCurrency;
    amountCup: number;
    amountUsd: number;
    denominationBreakdown: string | null;
  }) => Promise<void>;
}

/**
 * Modal reutilizable para registrar pagos internos a empleados con
 * cuadrícula de denominaciones (default Efectivo + CUP).
 *
 * @param props - Monto, callbacks y textos.
 */
export function EmployeePayCashierModal(props: EmployeePayCashierModalProps) {
  const { open, title, amountCup, description, onClose, onConfirm } = props;
  const [paymentMethod, setPaymentMethod] = useState<EmployeePayMethod>("efectivo");
  const [currency, setCurrency] = useState<DenominationCurrency>("CUP");
  const [counts, setCounts] = useState(() => emptyDenominationCounts("CUP"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setPaymentMethod("efectivo");
    setCurrency("CUP");
    setCounts(emptyDenominationCounts("CUP"));
    setError(null);
    setPending(false);
  }, [open, amountCup]);

  const received = useMemo(
    () => sumDenominationCounts(counts, currency),
    [counts, currency],
  );

  if (!open) {
    return null;
  }

  const handleConfirm = async () => {
    setError(null);
    if (amountCup <= 1e-9) {
      setError("No hay monto pendiente.");
      return;
    }
    if (paymentMethod === "efectivo" && currency === "CUP") {
      if (Math.abs(received - amountCup) > 0.05) {
        setError(
          `El desglose (${formatMoney(received)}) debe coincidir con ${formatMoney(amountCup)}.`,
        );
        return;
      }
    }
    setPending(true);
    try {
      const breakdown =
        paymentMethod === "efectivo"
          ? (() => {
              const payload = buildCountsPayload(counts, currency);
              return payload ? JSON.stringify(payload) : null;
            })()
          : null;
      await onConfirm({
        paymentMethod,
        currency,
        amountCup: currency === "CUP" ? amountCup : 0,
        amountUsd: currency === "USD" ? amountCup : 0,
        denominationBreakdown: breakdown,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el pago");
    } finally {
      setPending(false);
    }
  };

  return (
    <ModalPortal>
      <dialog className="modal modal-open">
        <div className="modal-box max-w-lg">
          <h3 className="font-bold text-lg">{title}</h3>
          {description && (
            <p className="mt-1 text-sm text-base-content/70">{description}</p>
          )}
          <div className="mt-3 flex justify-between text-sm font-semibold">
            <span>Monto a pagar</span>
            <span>{formatMoney(amountCup)}</span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="form-control">
              <span className="label-text text-xs">Método</span>
              <select
                className="select select-bordered select-sm"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as EmployeePayMethod)}
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </label>
            <label className="form-control">
              <span className="label-text text-xs">Moneda</span>
              <select
                className="select select-bordered select-sm"
                value={currency}
                onChange={(e) => {
                  const next = e.target.value as DenominationCurrency;
                  setCurrency(next);
                  setCounts(emptyDenominationCounts(next));
                }}
              >
                <option value="CUP">CUP</option>
                <option value="USD">USD</option>
              </select>
            </label>
          </div>

          {paymentMethod === "efectivo" && (
            <div className="mt-3">
              <DenominationGrid
                currency={currency}
                counts={counts}
                onChange={setCounts}
                label="Desglose de denominaciones"
              />
            </div>
          )}

          {error && <p className="mt-2 text-error text-sm">{error}</p>}

          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose} disabled={pending}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() => void handleConfirm()}
            >
              {pending ? <span className="loading loading-spinner loading-sm" /> : "Confirmar pago"}
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
