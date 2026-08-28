import { formatAmount, moneyHeading } from "@/lib/format-money";
import type { CashControlCurrencyDto } from "@/types/cashflow";
import type { DenominationCurrency } from "@/types/cashier";

interface CashOpeningTableProps {
  /** Resumen de la moneda (CUP o USD). */
  data: CashControlCurrencyDto;
}

/**
 * Formatea una cantidad de billetes sin decimales.
 *
 * @param value - Cantidad entera.
 * @returns Texto localizado, p. ej. `406`.
 */
function formatQty(value: number): string {
  return new Intl.NumberFormat("es", { maximumFractionDigits: 0 }).format(value);
}

/**
 * Tabla de saldo inicial al estilo de conteo físico: denominación, cantidad y subtotal.
 *
 * @param props - Datos de una moneda.
 * @returns Tarjeta con cabecera SALDO INICIAL y pie EFECTIVO.
 */
export function CashOpeningTable(props: CashOpeningTableProps) {
  const { data } = props;
  const currency = data.currency as DenominationCurrency;
  const totalClass = "bg-warning/30 font-semibold tabular-nums";

  return (
    <div className="overflow-hidden rounded-lg border border-base-300 bg-base-100">
      <div className="flex items-center justify-between border-b border-base-300 px-3 py-2">
        <h3 className="text-sm font-semibold">{moneyHeading("Saldo inicial", currency)}</h3>
        {!data.hasOpening ? (
          <span className="badge badge-ghost badge-sm">Sin registrar</span>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th className={totalClass}>Saldo inicial</th>
              <th className={totalClass} />
              <th className={`${totalClass} text-right`}>{formatAmount(data.openingTotal)}</th>
            </tr>
            <tr>
              <th>Denominación</th>
              <th className="text-right">Cantidad</th>
              <th className="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line) => {
              const empty = line.openingQty === 0;
              return (
                <tr key={line.denomination} className={empty ? "text-base-content/40" : undefined}>
                  <td className="tabular-nums">{formatAmount(line.denomination)}</td>
                  <td className="text-right tabular-nums">
                    {empty ? "—" : formatQty(line.openingQty)}
                  </td>
                  <td className="text-right tabular-nums">
                    {empty ? "—" : formatAmount(line.openingSubtotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className={totalClass}>Efectivo</td>
              <td className={totalClass} />
              <td className={`${totalClass} text-right`}>{formatAmount(data.openingTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
