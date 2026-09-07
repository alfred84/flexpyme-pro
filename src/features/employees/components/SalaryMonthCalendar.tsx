import { formatDate } from "@/lib/format-date";
import {
  WEEKDAY_LABELS,
  daysOfMonth,
  isoForDayInMonth,
  mondayFirstBlanks,
  monthTitleEs,
} from "@/features/employees/lib/salary-calendar";

interface SalaryMonthCalendarProps {
  /** Cualquier fecha ISO del mes a mostrar. */
  monthIso: string;
  /** Día seleccionado (`YYYY-MM-DD`). */
  selectedIso: string;
  /** Hoy (`YYYY-MM-DD`) para marcar y limitar futuros. */
  todayIso: string;
  /** Días pendientes de pago. */
  pendingDates?: string[];
  /** Días ya pagados (no seleccionables). */
  paidDates?: string[];
  /** Si es true, no se pueden elegir días posteriores a hoy. */
  disableFuture?: boolean;
  disabled?: boolean;
  /**
   * Cambia el día seleccionado.
   *
   * @param dateIso - Fecha ISO del día pulsado.
   */
  onSelect: (dateIso: string) => void;
}

/**
 * Cuadrícula mensual para habilitar un día de nómina.
 *
 * @param props - Mes, selección y estados por día.
 */
export function SalaryMonthCalendar(props: SalaryMonthCalendarProps) {
  const {
    monthIso,
    selectedIso,
    todayIso,
    pendingDates = [],
    paidDates = [],
    disableFuture = false,
    disabled = false,
    onSelect,
  } = props;
  const monthStart = `${monthIso.slice(0, 7)}-01`;
  const days = daysOfMonth(monthIso);
  const leadingBlanks = mondayFirstBlanks(monthStart);
  const pendingSet = new Set(pendingDates.map((d) => d.slice(0, 10)));
  const paidSet = new Set(paidDates.map((d) => d.slice(0, 10)));

  return (
    <div className="rounded-lg border border-base-300 bg-base-200/40 p-3">
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
          const iso = isoForDayInMonth(monthIso, option);
          const isSelected = iso === selectedIso;
          const isToday = iso === todayIso;
          const isPaid = paidSet.has(iso);
          const isPending = pendingSet.has(iso);
          const isFuture = disableFuture && iso > todayIso;
          const isDisabled = disabled || isPaid || isFuture;
          return (
            <button
              key={option}
              type="button"
              disabled={isDisabled}
              aria-pressed={isSelected}
              aria-label={formatDate(iso)}
              title={
                isPaid
                  ? `${formatDate(iso)} · pagado`
                  : isPending
                    ? `${formatDate(iso)} · en nómina`
                    : formatDate(iso)
              }
              className={`btn btn-sm h-9 min-h-0 px-0 ${
                isSelected
                  ? "btn-primary"
                  : isPaid
                    ? "btn-success btn-outline"
                    : isPending
                      ? "btn-info btn-outline"
                      : "btn-ghost"
              } ${isToday && !isSelected ? "ring-1 ring-primary/50" : ""}`}
              onClick={() => onSelect(iso)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
