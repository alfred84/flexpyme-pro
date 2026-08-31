import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDaysIso, clampIsoToMonth, formatDate } from "@/lib/format-date";
import type { CashControlDayDto } from "@/types/cashflow";

interface CashDayNavigatorProps {
  /** Mes `YYYY-MM` para limitar el rango. */
  month: string;
  /** Día seleccionado (`YYYY-MM-DD`). */
  selectedDay: string;
  /** Filas del mes (para marcar días con saldo o movimiento). */
  days: CashControlDayDto[];
  /** Cambia el día de monitoreo. */
  onSelectDay: (day: string) => void;
}

/**
 * Navegación compacta entre días del mes (anterior, selector, siguiente).
 *
 * @param props - Mes, día actual, listado y callback.
 * @returns Barra de selección de día.
 */
export function CashDayNavigator(props: CashDayNavigatorProps) {
  const { month, selectedDay, days, onSelectDay } = props;
  const start = `${month}-01`;
  const prev = clampIsoToMonth(addDaysIso(selectedDay, -1), month);
  const next = clampIsoToMonth(addDaysIso(selectedDay, 1), month);
  const atStart = selectedDay === start || prev === selectedDay;
  const atEnd = next === selectedDay;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-square"
        disabled={atStart}
        onClick={() => onSelectDay(prev)}
        aria-label="Día anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <select
        className="select select-bordered select-sm min-w-[12rem]"
        value={selectedDay}
        onChange={(e) => onSelectDay(e.target.value)}
        aria-label="Día"
      >
        {days.map((row) => {
          const marks: string[] = [];
          if (row.hasDeclaredOpening) {
            marks.push("saldo");
          }
          if (row.hasMovement) {
            marks.push("mov.");
          }
          const suffix = marks.length > 0 ? ` · ${marks.join(", ")}` : "";
          return (
            <option key={row.date} value={row.date}>
              {formatDate(row.date)}
              {suffix}
            </option>
          );
        })}
      </select>
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-square"
        disabled={atEnd}
        onClick={() => onSelectDay(next)}
        aria-label="Día siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
