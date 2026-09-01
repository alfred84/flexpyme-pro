import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchReportsSummary } from "@/db/queries/reports";
import { DualPhysicalAmounts, ReportKpiCard } from "@/features/reports/components/ReportKpis";
import type { OperationalReportViewProps } from "@/features/reports/components/report-view-props";
import type { ReportTableSection } from "@/lib/report-export";

const pct = new Intl.NumberFormat("es", { style: "percent", maximumFractionDigits: 1 });

/**
 * Facturación y cobros con montos físicos CUP/USD del periodo.
 *
 * @param props - Rango, habilitación y callback de exporte.
 * @returns Vista del informe.
 */
export function BillingReport(props: OperationalReportViewProps) {
  const { dateFrom, dateTo, enabled, periodLabel, onSectionsChange } = props;
  const query = useQuery({
    queryKey: ["reports", "summary", dateFrom, dateTo],
    queryFn: () => fetchReportsSummary({ dateFrom, dateTo }),
    enabled,
  });

  const s = query.data;
  const paidCup = Math.max(0, (s?.totalBilledCup ?? 0) - (s?.totalPendingCup ?? 0));
  const paidUsd = Math.max(0, (s?.totalBilledUsd ?? 0) - (s?.totalPendingUsd ?? 0));

  useEffect(() => {
    if (!enabled || !s) {
      onSectionsChange(null);
      return;
    }
    const sections: ReportTableSection[] = [
      {
        name: "FACTURACION",
        aoa: [
          ["Métrica", "CUP", "USD"],
          ["Periodo", periodLabel, ""],
          ["Facturas", s.invoicesCount, ""],
          ["Facturado", s.totalBilledCup, s.totalBilledUsd],
          ["Cobrado (estimado físico)", paidCup, paidUsd],
          ["Pendiente", s.totalPendingCup, s.totalPendingUsd],
          ["Tasa de cobro", s.collectionRate, ""],
          ["Pagadas / parciales / pendientes", `${s.invoicesPaidCount} / ${s.invoicesPartialCount} / ${s.invoicesPendingCount}`, ""],
        ],
      },
    ];
    onSectionsChange(sections);
  }, [enabled, onSectionsChange, paidCup, paidUsd, periodLabel, s]);

  if (!enabled) {
    return (
      <p className="py-10 text-center text-sm text-base-content/60">
        Complete el rango de fechas para ver el informe.
      </p>
    );
  }
  if (query.isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-base-200" />;
  }
  if (query.isError || !s) {
    return (
      <div className="alert alert-error">
        <span>No se pudo cargar la facturación.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ReportKpiCard label="Facturado">
          <DualPhysicalAmounts amountCup={s.totalBilledCup} amountUsd={s.totalBilledUsd} />
        </ReportKpiCard>
        <ReportKpiCard label="Cobrado">
          <DualPhysicalAmounts amountCup={paidCup} amountUsd={paidUsd} valueClassName="text-success" />
        </ReportKpiCard>
        <ReportKpiCard label="Pendiente">
          <DualPhysicalAmounts
            amountCup={s.totalPendingCup}
            amountUsd={s.totalPendingUsd}
            valueClassName="text-warning"
          />
        </ReportKpiCard>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ReportKpiCard label="Facturas">
          <p className="text-2xl font-semibold">{s.invoicesCount}</p>
        </ReportKpiCard>
        <ReportKpiCard label="Pagadas · parciales · pendientes">
          <p className="text-lg font-semibold">
            {s.invoicesPaidCount} · {s.invoicesPartialCount} · {s.invoicesPendingCount}
          </p>
        </ReportKpiCard>
        <ReportKpiCard label="Tasa de cobro">
          <p className="text-2xl font-semibold">{pct.format(s.collectionRate)}</p>
        </ReportKpiCard>
      </div>
    </div>
  );
}
