import type { ReactNode } from "react";

export { DualPhysicalAmounts } from "@/components/common/DualPhysicalAmounts";

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
