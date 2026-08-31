import { formatAmount, moneyHeading } from "@/lib/format-money";
import type { CashControlCurrencyDto } from "@/types/cashflow";
import type { DenominationCurrency } from "@/types/cashier";

interface CashMonitorTableProps {
  /** Resumen de la moneda (CUP o USD). */
  data: CashControlCurrencyDto;
  /** Alcance del monitoreo (`mes` o `día`). */
  scope?: "mes" | "dia";
}

/**
 * Formatea una cantidad de billetes; marca negativos.
 *
 * @param value - Cantidad (puede ser negativa si el estimado se desvía).
 * @returns Texto localizado.
 */
function formatQty(value: number): string {
  return new Intl.NumberFormat("es", { maximumFractionDigits: 0 }).format(value);
}

/**
 * Clase de celda numérica según el valor.
 *
 * @param value - Cantidad o importe.
 * @param emptyMuted - Si verdadero, los ceros se atenúan.
 * @returns Clases Tailwind.
 */
function qtyClass(value: number, emptyMuted = true): string {
  if (value < 0) {
    return "text-right tabular-nums font-semibold text-error";
  }
  if (emptyMuted && value === 0) {
    return "text-right tabular-nums text-base-content/40";
  }
  return "text-right tabular-nums";
}

/**
 * Tabla de monitoreo por denominación: inicial, entradas, salidas y estimado.
 *
 * @param props - Datos de una moneda y alcance (mes o día).
 * @returns Tabla de seguimiento físico.
 */
export function CashMonitorTable(props: CashMonitorTableProps) {
  const { data, scope = "mes" } = props;
  const currency = data.currency as DenominationCurrency;
  const isDay = scope === "dia";
  const title = isDay ? "Movimiento del día" : "Movimiento del mes";
  const hint = isDay
    ? "Inicial del día (registrado o estimado) + entradas − salidas."
    : "Estimado = inicial del mes + entradas − salidas (solo efectivo con desglose).";
  const inicialLabel = isDay ? "Inicial del día" : "Inicial";

  return (
    <div className="overflow-hidden rounded-lg border border-base-300 bg-base-100">
      <div className="border-b border-base-300 px-3 py-2">
        <h3 className="text-sm font-semibold">{moneyHeading(title, currency)}</h3>
        <p className="text-xs text-base-content/60">{hint}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Denominación</th>
              <th className="text-right">{inicialLabel}</th>
              <th className="text-right">Entradas</th>
              <th className="text-right">Salidas</th>
              <th className="text-right">Estimado</th>
              <th className="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line) => (
              <tr key={line.denomination}>
                <td className="tabular-nums">{formatAmount(line.denomination)}</td>
                <td className={qtyClass(line.openingQty)}>{formatQty(line.openingQty)}</td>
                <td className={qtyClass(line.inQty, false)}>
                  {line.inQty === 0 ? "—" : formatQty(line.inQty)}
                </td>
                <td className={qtyClass(line.outQty, false)}>
                  {line.outQty === 0 ? "—" : formatQty(line.outQty)}
                </td>
                <td className={qtyClass(line.estimatedQty, false)}>{formatQty(line.estimatedQty)}</td>
                <td className={qtyClass(line.estimatedSubtotal, false)}>
                  {formatAmount(line.estimatedSubtotal)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold bg-base-200/80">
              <td>Total</td>
              <td className="text-right tabular-nums">{formatAmount(data.openingTotal)}</td>
              <td className="text-right tabular-nums text-success">{formatAmount(data.inTotal)}</td>
              <td className="text-right tabular-nums">{formatAmount(data.outTotal)}</td>
              <td className={qtyClass(data.estimatedTotal, false)}>{formatAmount(data.estimatedTotal)}</td>
              <td className={qtyClass(data.estimatedTotal, false)}>{formatAmount(data.estimatedTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
