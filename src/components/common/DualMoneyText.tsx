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
 * Si la moneda principal es USD y no hay tasa usable, se muestra CUP para no
 * ocultar importes reales como `$ 0,00`.
 *
 * @param props - Importe CUP, tasa y moneda principal.
 * @returns Bloque de importe dual.
 */
export function DualMoneyText(props: DualMoneyTextProps) {
  const { amountCup, rate, primary = "USD", prefix = "", className = "" } = props;
  const canConvert = rate > 0;
  const effectivePrimary: SaleCurrency =
    primary === "USD" && !canConvert ? "CUP" : primary;
  const usd = canConvert ? cupToUsd(amountCup, rate) : 0;
  const primaryAmount = effectivePrimary === "USD" ? usd : amountCup;
  const secondaryAmount = effectivePrimary === "USD" ? amountCup : usd;
  const secondaryCurrency: SaleCurrency = effectivePrimary === "USD" ? "CUP" : "USD";
  const canShowSecondary = canConvert && effectivePrimary === primary;

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
