import { formatDate } from "@/lib/format-date";
import { formatAmount } from "@/lib/format-money";
import type { CashControlDayDto } from "@/types/cashflow";

interface CashDailyTableProps {
  /** Filas de cada día del mes. */
  days: CashControlDayDto[];
  /** Día seleccionado (`YYYY-MM-DD`). */
  selectedDay: string;
  /** Cambia el día de monitoreo. */
  onSelectDay: (day: string) => void;
}

/**
 * Clase de importe según signo y si el día tuvo movimiento.
 *
 * @param value - Importe.
 * @param muted - Atenuar ceros sin movimiento.
 * @returns Clases Tailwind.
 */
function amountClass(value: number, muted: boolean): string {
  if (value < 0) {
    return "text-right tabular-nums font-semibold text-error";
  }
  if (muted && value === 0) {
    return "text-right tabular-nums text-base-content/40";
  }
  return "text-right tabular-nums";
}

/**
 * Tabla de monitoreo diario del mes: entradas, salidas y estimado al cierre.
 *
 * @param props - Días, selección y callback.
 * @returns Tabla clicable por día.
 */
export function CashDailyTable(props: CashDailyTableProps) {
  const { days, selectedDay, onSelectDay } = props;

  return (
    <div className="overflow-hidden rounded-lg border border-base-300 bg-base-100">
      <div className="border-b border-base-300 px-3 py-2">
        <h3 className="text-sm font-semibold">Resumen por día</h3>
        <p className="text-xs text-base-content/60">
          El cierre de cada día arranca del saldo inicial del mes. Pulsa un día para ver el desglose
          por denominación.
        </p>
      </div>
      <div className="max-h-[28rem] overflow-auto">
        <table className="table table-sm table-pin-rows">
          <thead>
            <tr>
              <th>Fecha</th>
              <th className="text-right">Entradas (CUP)</th>
              <th className="text-right">Salidas (CUP)</th>
              <th className="text-right">Cierre (CUP)</th>
              <th className="text-right">Entradas (USD)</th>
              <th className="text-right">Salidas (USD)</th>
              <th className="text-right">Cierre (USD)</th>
            </tr>
          </thead>
          <tbody>
            {days.map((row) => {
              const selected = row.date === selectedDay;
              const muted = !row.hasMovement;
              return (
                <tr
                  key={row.date}
                  className={`cursor-pointer ${selected ? "bg-primary/10" : muted ? "opacity-70" : ""}`}
                  onClick={() => onSelectDay(row.date)}
                >
                  <td className="whitespace-nowrap font-medium">
                    {formatDate(row.date)}
                    {selected ? (
                      <span className="ml-2 badge badge-primary badge-xs">Seleccionado</span>
                    ) : null}
                  </td>
                  <td className={amountClass(row.inTotalCup, muted)}>
                    {row.inTotalCup === 0 ? "—" : formatAmount(row.inTotalCup)}
                  </td>
                  <td className={amountClass(row.outTotalCup, muted)}>
                    {row.outTotalCup === 0 ? "—" : formatAmount(row.outTotalCup)}
                  </td>
                  <td className={amountClass(row.estimatedTotalCup, false)}>
                    {formatAmount(row.estimatedTotalCup)}
                  </td>
                  <td className={amountClass(row.inTotalUsd, muted)}>
                    {row.inTotalUsd === 0 ? "—" : formatAmount(row.inTotalUsd)}
                  </td>
                  <td className={amountClass(row.outTotalUsd, muted)}>
                    {row.outTotalUsd === 0 ? "—" : formatAmount(row.outTotalUsd)}
                  </td>
                  <td className={amountClass(row.estimatedTotalUsd, false)}>
                    {formatAmount(row.estimatedTotalUsd)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
