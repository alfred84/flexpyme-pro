import { sumDenominationCounts } from "@/lib/cash-counts";
import { formatMoney } from "@/lib/format-money";
import { denominationsFor, type DenominationCurrency } from "@/types/cashier";

interface DenominationGridProps {
  /** Moneda de la cuadrícula (define el set de denominaciones). */
  currency: DenominationCurrency;
  /** Conteo actual por denominación (clave = valor de la denominación). */
  counts: Record<string, number>;
  /** Callback con el conteo actualizado. */
  onChange: (counts: Record<string, number>) => void;
  /** Título opcional del bloque. */
  label?: string;
  /** Oculta la fila de total (por defecto se muestra). */
  hideTotal?: boolean;
}

/**
 * Cuadrícula de conteo de billetes por denominación (CUP o USD).
 *
 * Estándar para todo ingreso/egreso en efectivo de la app: cobros de pedidos,
 * vuelto, movimientos de caja y otros gastos.
 *
 * @param props - Moneda, conteo controlado y callback de cambio.
 * @returns Bloque de inputs por denominación con total calculado.
 */
export function DenominationGrid(props: DenominationGridProps) {
  const { currency, counts, onChange, label, hideTotal } = props;
  const denominations = denominationsFor(currency);
  const total = sumDenominationCounts(counts, currency);

  const setDenom = (key: string, raw: number) => {
    const value = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    onChange({ ...counts, [key]: value });
  };

  return (
    <div className="space-y-1">
      {label && <p className="text-xs text-base-content/60">{label}</p>}
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
        {denominations.map((d) => (
          <label key={d} className="form-control">
            <span className="label-text text-[10px] font-mono">
              {currency === "USD" ? `$${d}` : formatMoney(d)}
            </span>
            <input
              type="number"
              min={0}
              className="input input-bordered input-xs"
              value={counts[String(d)] ?? 0}
              onChange={(e) => setDenom(String(d), Number(e.target.value))}
            />
          </label>
        ))}
      </div>
      {!hideTotal && (
        <p className="text-right text-xs">
          Total {currency}:{" "}
          <span className="font-semibold">
            {currency === "USD" ? `$ ${total.toFixed(2)}` : formatMoney(total)}
          </span>
        </p>
      )}
    </div>
  );
}
