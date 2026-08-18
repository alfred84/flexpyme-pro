import { CircleDollarSign } from "lucide-react";
import { ModalPortal } from "@/components/common/ModalPortal";
import { formatMoney } from "@/lib/format-money";
import {
  CLIENT_CREDIT_NOTICE_EPS,
  type ClientCreditNotice,
} from "@/features/invoices/lib/client-credit-notice";

interface ClientCreditNoticeModalProps {
  open: boolean;
  clientName: string;
  notice: ClientCreditNotice;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Aviso amigable antes de cobrar si el cliente tiene o va a tener saldo a favor.
 *
 * @param props - Datos del cliente, importes y callbacks.
 */
export function ClientCreditNoticeModal(props: ClientCreditNoticeModalProps) {
  const { open, clientName, notice, isSubmitting, onClose, onConfirm } = props;

  if (!open) {
    return null;
  }

  const hasExisting = notice.existingCreditCup > CLIENT_CREDIT_NOTICE_EPS;
  const willApply = notice.creditToApplyCup > CLIENT_CREDIT_NOTICE_EPS;
  const willAdd = notice.creditToAddCup > CLIENT_CREDIT_NOTICE_EPS;
  const unusedExisting =
    hasExisting && notice.existingCreditCup - notice.creditToApplyCup > CLIENT_CREDIT_NOTICE_EPS;

  return (
    <ModalPortal>
      <dialog className="modal modal-open">
        <div className="modal-box max-w-md">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
              <CircleDollarSign className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-lg font-bold">Saldo a favor</h3>
              <p className="mt-1 text-sm text-base-content/70">
                Antes de cobrar a <span className="font-medium">{clientName}</span>, revisa cómo
                queda su crédito.
              </p>
            </div>
          </div>

          <ul className="mt-4 space-y-2 text-sm">
            {hasExisting && (
              <li className="rounded-lg bg-success/10 px-3 py-2">
                Ya tiene <strong>{formatMoney(notice.existingCreditCup, "CUP")}</strong> de saldo a
                favor.
              </li>
            )}
            {willApply && (
              <li className="rounded-lg bg-base-200 px-3 py-2">
                En este cobro se aplicarán{" "}
                <strong>{formatMoney(notice.creditToApplyCup, "CUP")}</strong> a la cuenta del
                pedido.
              </li>
            )}
            {hasExisting && !willApply && (
              <li className="rounded-lg bg-base-200 px-3 py-2">
                Ese saldo no se aplicará ahora. Si quieres usarlo, marca «Aplicar saldo a favor»
                antes de continuar.
              </li>
            )}
            {willAdd && (
              <li className="rounded-lg bg-info/10 px-3 py-2">
                Este cobro dejará{" "}
                <strong>{formatMoney(notice.creditToAddCup, "CUP")}</strong> a favor. El dinero
                permanece en caja.
              </li>
            )}
            {(willApply || willAdd || unusedExisting) && (
              <li className="rounded-lg border border-success/30 px-3 py-2 font-medium text-success">
                Después de cobrar, el saldo a favor será{" "}
                {formatMoney(notice.creditAfterCup, "CUP")}.
              </li>
            )}
          </ul>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Volver
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSubmitting}
              onClick={onConfirm}
            >
              {isSubmitting ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                "Continuar cobro"
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
