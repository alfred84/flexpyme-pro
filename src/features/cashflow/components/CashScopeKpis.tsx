import { formatAmount } from "@/lib/format-money";
import type { CashControlCurrencyDto } from "@/types/cashflow";

interface CashScopeKpisProps {
  /** Totales CUP del periodo visible. */
  cup: CashControlCurrencyDto;
  /** Totales USD del periodo visible. */
  usd: CashControlCurrencyDto;
  /** `mes` o `día` (cambia la etiqueta de estimado). */
  scope: "mes" | "dia";
}

/**
 * Resumen compacto CUP/USD: inicial, entradas, salidas y estimado.
 *
 * @param props - Totales de ambas monedas y alcance.
 * @returns Tarjeta de indicadores del periodo.
 */
export function CashScopeKpis(props: CashScopeKpisProps) {
  const { cup, usd, scope } = props;
  const estimadoLabel = scope === "dia" ? "Estimado al cierre" : "Estimado";

  return (
    <div className="overflow-hidden rounded-lg border border-base-300 bg-base-100">
      <table className="table table-sm">
        <thead>
          <tr>
            <th />
            <th className="text-right">CUP</th>
            <th className="text-right">USD</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="text-base-content/70">
              Inicial
              {!cup.hasOpening ? (
                <span className="ml-2 badge badge-ghost badge-xs">
                  {cup.openingTotal > 0 || usd.openingTotal > 0 ? "Estimado" : "Sin registrar"}
                </span>
              ) : (
                <span className="ml-2 badge badge-success badge-xs">Registrado</span>
              )}
            </td>
            <td className="text-right tabular-nums">{formatAmount(cup.openingTotal)}</td>
            <td className="text-right tabular-nums">{formatAmount(usd.openingTotal)}</td>
          </tr>
          <tr>
            <td className="text-base-content/70">Entradas</td>
            <td className="text-right tabular-nums text-success">{formatAmount(cup.inTotal)}</td>
            <td className="text-right tabular-nums text-success">{formatAmount(usd.inTotal)}</td>
          </tr>
          <tr>
            <td className="text-base-content/70">Salidas</td>
            <td className="text-right tabular-nums">{formatAmount(cup.outTotal)}</td>
            <td className="text-right tabular-nums">{formatAmount(usd.outTotal)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="bg-warning/20">
            <td className="font-semibold">{estimadoLabel}</td>
            <td className="text-right text-lg font-semibold tabular-nums">
              {formatAmount(cup.estimatedTotal)}
            </td>
            <td className="text-right text-lg font-semibold tabular-nums">
              {formatAmount(usd.estimatedTotal)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
