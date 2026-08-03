import { cupToUsd, type SaleCurrency } from "@/lib/currency";
import { formatAmount, formatMoney } from "@/lib/format-money";

interface DualMoneyTextProps {
  /** Importe del libro contable (siempre CUP). */
  amountCup: number;
  /** Tasa USD→CUP para el equivalente. */
  rate: number;
  /** Moneda destacada en la UI. */
  primary?: SaleCurrency;
  /** Prefijo opcional (p. ej. `−`). */
  prefix?: string;
  /** Clase del contenedor. */
  className?: string;
}

/**
 * Muestra un importe con moneda principal y equivalente secundario.
 *
 * El libro del pedido permanece en CUP; esta vista solo convierte para la UI.
 *
 * @param props - Importe CUP, tasa y moneda principal.
 * @returns Bloque de importe dual.
 */
export function DualMoneyText(props: DualMoneyTextProps) {
  const { amountCup, rate, primary = "USD", prefix = "", className = "" } = props;
  const usd = cupToUsd(amountCup, rate);
  const primaryAmount = primary === "USD" ? usd : amountCup;
  const secondaryAmount = primary === "USD" ? amountCup : usd;
  const secondaryCurrency: SaleCurrency = primary === "USD" ? "CUP" : "USD";
  const canShowSecondary = rate > 0;

  return (
    <span className={`inline-flex flex-col items-end leading-tight ${className}`}>
      <span>
        {prefix}
        {formatAmount(primaryAmount)}
      </span>
      {canShowSecondary ? (
        <span className="text-[10px] font-normal text-base-content/50">
          {prefix}
          {formatMoney(secondaryAmount, secondaryCurrency)}
        </span>
      ) : null}
    </span>
  );
}
