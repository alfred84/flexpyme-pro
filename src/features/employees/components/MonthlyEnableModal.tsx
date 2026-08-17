import { useEffect, useMemo, useState } from "react";
import { ModalPortal } from "@/components/common/ModalPortal";
import { formatDate, monthEndIso, monthStartIso, todayIso } from "@/lib/format-date";

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"] as const;

const MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

interface MonthlyEnableModalProps {
  open: boolean;
  employeeName: string;
  /** Fecha ya habilitada este mes, si existe. */
  scheduledDate: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  /**
   * Confirma el día de nómina elegido.
   *
   * @param dateIso - Fecha ISO `YYYY-MM-DD` dentro del mes actual.
   */
  onConfirm: (dateIso: string) => Promise<void>;
}

/**
 * Días del 1 al último del mes de `isoDate`.
 *
 * @param isoDate - Fecha ISO de referencia.
 * @returns Números de día del mes.
 */
function daysOfMonth(isoDate: string): number[] {
  const lastDay = Number(monthEndIso(isoDate).slice(8, 10));
  if (!Number.isFinite(lastDay) || lastDay < 1) {
    return [];
  }
  return Array.from({ length: lastDay }, (_, index) => index + 1);
}

/**
 * Arma la fecha ISO del día `dayOfMonth` en el mes de `isoDate`.
 *
 * @param isoDate - Fecha ISO de referencia del mes.
 * @param dayOfMonth - Día 1..N.
 * @returns `YYYY-MM-DD`.
 */
function isoForDayInMonth(isoDate: string, dayOfMonth: number): string {
  const month = monthStartIso(isoDate).slice(0, 7);
  return `${month}-${String(dayOfMonth).padStart(2, "0")}`;
}

/**
 * Extrae el día del mes (1..31) de una fecha ISO.
 *
 * @param isoDate - Fecha ISO.
 * @returns Día numérico o `null`.
 */
function dayOfIso(isoDate: string | null): number | null {
  if (!isoDate || isoDate.length < 10) {
    return null;
  }
  const day = Number(isoDate.slice(8, 10));
  return Number.isFinite(day) && day >= 1 ? day : null;
}

/**
 * Índice 0..6 del primer día del mes, con lunes = 0.
 *
 * @param monthStart - Primer día del mes en ISO.
 * @returns Huecos vacíos al inicio de la cuadrícula.
 */
function mondayFirstBlanks(monthStart: string): number {
  const parsed = new Date(`${monthStart}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }
  return (parsed.getDay() + 6) % 7;
}

/**
 * Título de mes en español (`Agosto 2026`).
 *
 * @param monthStart - Primer día del mes en ISO.
 * @returns Nombre del mes y año.
 */
function monthTitleEs(monthStart: string): string {
  const monthIndex = Number(monthStart.slice(5, 7)) - 1;
  const year = monthStart.slice(0, 4);
  const name = MONTH_NAMES_ES[monthIndex];
  return name ? `${name} ${year}` : monthStart;
}

/**
 * Modal para elegir el día del mes en que el salario mensual entra a la nómina.
 *
 * @param props - Empleado, fecha previa y callbacks.
 */
export function MonthlyEnableModal(props: MonthlyEnableModalProps) {
  const { open, employeeName, scheduledDate, isSubmitting, onClose, onConfirm } = props;
  const today = todayIso();
  const monthStart = monthStartIso(today);
  const monthEnd = monthEndIso(today);
  const days = useMemo(() => daysOfMonth(today), [today]);
  const leadingBlanks = useMemo(() => mondayFirstBlanks(monthStart), [monthStart]);
  const [day, setDay] = useState(Number(today.slice(8, 10)));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const scheduledDay = dayOfIso(scheduledDate);
    const scheduledInThisMonth =
      scheduledDate != null && scheduledDate >= monthStart && scheduledDate <= monthEnd;
    setDay(scheduledInThisMonth && scheduledDay != null ? scheduledDay : Number(today.slice(8, 10)));
    setError(null);
  }, [open, scheduledDate, monthStart, monthEnd, today]);

  if (!open) {
    return null;
  }

  const selectedIso = isoForDayInMonth(today, day);
  const todayDay = Number(today.slice(8, 10));

  const handleConfirm = async () => {
    setError(null);
    if (!days.includes(day)) {
      setError("Elige un día válido de este mes.");
      return;
    }
    if (selectedIso < monthStart || selectedIso > monthEnd) {
      setError("El día debe pertenecer al mes en curso.");
      return;
    }
    try {
      await onConfirm(selectedIso);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo habilitar el salario mensual.");
    }
  };

  return (
    <ModalPortal>
      <dialog className="modal modal-open">
        <div className="modal-box max-w-sm">
          <h3 className="text-lg font-bold">Habilitar salario mensual</h3>
          <p className="mt-1 text-sm text-base-content/70">
            Elige el día en que <span className="font-medium">{employeeName}</span> aparecerá en la
            nómina.
          </p>
          <div className="mt-4 rounded-lg border border-base-300 bg-base-200/40 p-3">
            <p className="mb-2 text-center text-sm font-semibold">{monthTitleEs(monthStart)}</p>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-base-content/50">
              {WEEKDAY_LABELS.map((label) => (
                <span key={label} className="py-1 font-medium">
                  {label}
                </span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {Array.from({ length: leadingBlanks }, (_, index) => (
                <span key={`blank-${index}`} className="h-9" />
              ))}
              {days.map((option) => {
                const isSelected = option === day;
                const isToday = option === todayDay;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={isSubmitting}
                    aria-pressed={isSelected}
                    aria-label={formatDate(isoForDayInMonth(today, option))}
                    title={formatDate(isoForDayInMonth(today, option))}
                    className={`btn btn-sm h-9 min-h-0 px-0 ${
                      isSelected ? "btn-primary" : "btn-ghost"
                    } ${isToday && !isSelected ? "ring-1 ring-primary/50" : ""}`}
                    onClick={() => {
                      setDay(option);
                      setError(null);
                    }}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-xs text-base-content/60">
            Se habilitará para el {formatDate(selectedIso)}. Un solo cobro este mes.
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
