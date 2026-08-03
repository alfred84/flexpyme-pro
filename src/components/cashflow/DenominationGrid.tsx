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

  /**
   * Actualiza el conteo de una denominación a partir del texto del input.
   * Usa cadena vacía como “0” visible para evitar el bug de React con ceros
   * a la izquierda en `type="number"` controlados (p. ej. teclear 1 → "01").
   *
   * @param key - Valor de la denominación como string.
   * @param raw - Texto del input.
   */
  const setDenom = (key: string, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    const value = digits === "" ? 0 : Math.max(0, Math.floor(Number(digits)));
    onChange({ ...counts, [key]: Number.isFinite(value) ? value : 0 });
  };

  return (
    <div className="space-y-1">
      {label && <p className="text-xs text-base-content/60">{label}</p>}
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
        {denominations.map((d) => {
          const key = String(d);
          const count = counts[key] ?? 0;
          return (
            <label key={d} className="form-control">
              <span className="label-text text-[10px] font-mono">
                {formatMoney(d, currency)}
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="input input-bordered input-xs"
                value={count === 0 ? "" : String(count)}
                placeholder="0"
                onChange={(e) => setDenom(key, e.target.value)}
                aria-label={`Cantidad de ${formatMoney(d, currency)}`}
              />
            </label>
          );
        })}
      </div>
      {!hideTotal && (
        <p className="text-right text-xs">
          Total:{" "}
          <span className="font-semibold">{formatMoney(total, currency)}</span>
        </p>
      )}
    </div>
  );
}
