import { useEffect, useMemo, useState } from "react";
import { ModalPortal } from "@/components/common/ModalPortal";
import { SalaryMonthCalendar } from "@/features/employees/components/SalaryMonthCalendar";
import { formatDate, monthEndIso, monthStartIso, todayIso } from "@/lib/format-date";

interface FixedDailyEnableModalProps {
  open: boolean;
  employeeName: string;
  /** Fecha de referencia (nómina seleccionada). */
  referenceDate: string;
  /** Días del mes ya habilitados y pendientes. */
  pendingDates: string[];
  /** Días del mes ya pagados. */
  paidDates: string[];
  isSubmitting?: boolean;
  onClose: () => void;
  /**
   * Confirma el día laborable a habilitar.
   *
   * @param dateIso - Fecha ISO `YYYY-MM-DD`.
   */
  onConfirm: (dateIso: string) => Promise<void>;
}

/**
 * Modal para habilitar el salario fijo diario en un día trabajado.
 *
 * @param props - Empleado, días ya habilitados y callbacks.
 */
export function FixedDailyEnableModal(props: FixedDailyEnableModalProps) {
  const {
    open,
    employeeName,
    referenceDate,
    pendingDates,
    paidDates,
    isSubmitting,
    onClose,
    onConfirm,
  } = props;
  const today = todayIso();
  const monthStart = monthStartIso(referenceDate || today);
  const monthEnd = monthEndIso(referenceDate || today);
  const [selectedIso, setSelectedIso] = useState(today);
  const [error, setError] = useState<string | null>(null);

  const defaultIso = useMemo(() => {
    const ref = (referenceDate || today).slice(0, 10);
    if (ref >= monthStart && ref <= monthEnd && ref <= today) {
      return ref;
    }
    return today >= monthStart && today <= monthEnd ? today : monthStart;
  }, [referenceDate, today, monthStart, monthEnd]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedIso(defaultIso);
    setError(null);
  }, [open, defaultIso]);

  if (!open) {
    return null;
  }

  const handleConfirm = async () => {
    setError(null);
    if (selectedIso < monthStart || selectedIso > monthEnd) {
      setError("El día debe pertenecer al mes mostrado.");
      return;
    }
    if (selectedIso > today) {
      setError("Solo puedes habilitar días ya trabajados (hasta hoy).");
      return;
    }
    if (paidDates.some((d) => d.slice(0, 10) === selectedIso)) {
      setError("El salario de ese día ya está pagado.");
      return;
    }
    try {
      await onConfirm(selectedIso);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo habilitar el salario del día.");
    }
  };

  return (
    <ModalPortal>
      <dialog className="modal modal-open">
        <div className="modal-box max-w-sm">
          <h3 className="text-lg font-bold">Habilitar salario diario</h3>
          <p className="mt-1 text-sm text-base-content/70">
            Elige el día en que <span className="font-medium">{employeeName}</span> trabajó. Solo
            esos días entran a la nómina.
          </p>
          <div className="mt-4">
            <SalaryMonthCalendar
              monthIso={monthStart}
              selectedIso={selectedIso}
              todayIso={today}
              pendingDates={pendingDates}
              paidDates={paidDates}
              disableFuture
              disabled={isSubmitting}
              onSelect={(iso) => {
                setSelectedIso(iso);
                setError(null);
              }}
            />
          </div>
          <p className="mt-2 text-xs text-base-content/60">
            Se habilitará para el {formatDate(selectedIso)}. Puedes marcar varios días este mes,
            uno por cada día trabajado.
          </p>
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
                "Habilitar"
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
