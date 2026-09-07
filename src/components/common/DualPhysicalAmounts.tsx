import { formatAmount, moneyHeading } from "@/lib/format-money";

interface DualPhysicalAmountsProps {
  amountCup: number;
  amountUsd: number;
  valueClassName?: string;
  /** Etiqueta de cada moneda (por defecto «Importe»). */
  label?: string;
  className?: string;
}

/**
 * Importes físicos: USD a la izquierda (principal) y CUP a la derecha.
 *
 * No convierte entre monedas; cada cajón es independiente.
 *
 * @param props - Montos por moneda y estilo opcional.
 * @returns Bloque dual USD | CUP.
 */
export function DualPhysicalAmounts(props: DualPhysicalAmountsProps) {
  const { amountCup, amountUsd, valueClassName = "", label = "Importe", className = "" } = props;
  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`.trim()}>
      <div>
        <p className="text-[10px] font-normal uppercase tracking-wide text-base-content/50">
          {moneyHeading(label, "USD")}
        </p>
        <p className={`text-lg font-semibold tabular-nums ${valueClassName}`}>
          {formatAmount(amountUsd)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-normal uppercase tracking-wide text-base-content/50">
          {moneyHeading(label, "CUP")}
        </p>
        <p className={`text-lg font-semibold tabular-nums ${valueClassName}`}>
          {formatAmount(amountCup)}
        </p>
      </div>
    </div>
  );
}
