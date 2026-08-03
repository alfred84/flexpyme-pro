import { useEffect, useState } from "react";
import { ModalPortal } from "@/components/common/ModalPortal";
import { formatMoney } from "@/lib/format-money";

interface DestajoDefineModalProps {
  open: boolean;
  employeeName: string;
  /** Importe actual (si ya estaba definido). */
  currentAmountCup: number | null;
  isSubmitting?: boolean;
  onClose: () => void;
  /**
   * Confirma el importe de destajo del día.
   *
   * @param amountCup - Importe en CUP.
   */
  onConfirm: (amountCup: number) => Promise<void>;
}

/**
 * Modal para definir o editar el destajo diario de un empleado.
 *
 * @param props - Datos del empleado y callbacks.
 */
export function DestajoDefineModal(props: DestajoDefineModalProps) {
  const { open, employeeName, currentAmountCup, isSubmitting, onClose, onConfirm } = props;
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setAmount(
      currentAmountCup != null && currentAmountCup > 0 ? String(currentAmountCup) : "",
    );
    setError(null);
  }, [open, currentAmountCup]);

  if (!open) {
    return null;
  }

  const handleConfirm = async () => {
    setError(null);
    const value = Number(amount.trim().replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setError("Indica un importe de destajo mayor que cero.");
      return;
    }
    try {
      await onConfirm(value);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el destajo.");
    }
  };

  return (
    <ModalPortal>
      <dialog className="modal modal-open">
        <div className="modal-box max-w-sm">
          <h3 className="text-lg font-bold">Destajo del día</h3>
          <p className="mt-1 text-sm text-base-content/70">
            Define el importe CUP para <span className="font-medium">{employeeName}</span>
            {currentAmountCup != null && currentAmountCup > 0
              ? ` (actual: ${formatMoney(currentAmountCup)}).`
              : "."}
          </p>
          <label className="form-control mt-4 w-full">
            <span className="label-text">Importe (CUP)</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              className="input input-bordered"
              autoFocus
              value={amount}
              disabled={isSubmitting}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleConfirm();
                }
              }}
            />
          </label>
          {error && <p className="mt-2 text-sm text-error">{error}</p>}
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSubmitting}
              onClick={() => void handleConfirm()}
            >
              {isSubmitting ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                "Guardar"
              )}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" disabled={isSubmitting} onClick={onClose}>
            close
          </button>
        </form>
      </dialog>
    </ModalPortal>
  );
}
