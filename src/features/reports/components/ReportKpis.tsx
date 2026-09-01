import type { ReactNode } from "react";
import { formatAmount, moneyHeading } from "@/lib/format-money";

interface DualPhysicalAmountsProps {
  amountCup: number;
  amountUsd: number;
  valueClassName?: string;
}

/**
 * Importes físicos CUP y USD (sin conversión), mismo patrón que Caja y Facturas.
 *
 * @param props - Montos por moneda.
 * @returns Bloque dual.
 */
export function DualPhysicalAmounts(props: DualPhysicalAmountsProps) {
  const { amountCup, amountUsd, valueClassName = "" } = props;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-base-content/50">
          {moneyHeading("Importe", "CUP")}
        </p>
        <p className={`text-lg font-semibold tabular-nums ${valueClassName}`}>
          {formatAmount(amountCup)}
        </p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-base-content/50">
          {moneyHeading("Importe", "USD")}
        </p>
        <p className={`text-lg font-semibold tabular-nums ${valueClassName}`}>
          {formatAmount(amountUsd)}
        </p>
      </div>
    </div>
  );
}

interface ReportKpiCardProps {
  label: string;
  children: ReactNode;
}

/**
 * Tarjeta KPI compacta para un informe.
 *
 * @param props - Etiqueta y contenido.
 * @returns Card DaisyUI.
 */
export function ReportKpiCard(props: ReportKpiCardProps) {
  return (
    <div className="rounded-lg border border-base-300 bg-base-100 p-3">
      <p className="text-xs uppercase text-base-content/60">{props.label}</p>
      <div className="mt-1">{props.children}</div>
    </div>
  );
}
