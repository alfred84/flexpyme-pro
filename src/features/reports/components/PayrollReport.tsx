import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPayrollInRange } from "@/db/queries/employees";
import { ReportKpiCard } from "@/features/reports/components/ReportKpis";
import type { OperationalReportViewProps } from "@/features/reports/components/report-view-props";
import { formatAmount, moneyHeading } from "@/lib/format-money";
import type { ReportTableSection } from "@/lib/report-export";

/**
 * Nómina agregada por empleado (CUP) en el periodo.
 *
 * @param props - Rango, habilitación y callback de exporte.
 * @returns Vista del informe.
 */
export function PayrollReport(props: OperationalReportViewProps) {
  const { dateFrom, dateTo, enabled, periodLabel, onSectionsChange } = props;
  const query = useQuery({
    queryKey: ["reports", "payroll", dateFrom, dateTo],
    queryFn: () => fetchPayrollInRange({ dateFrom, dateTo }),
    enabled,
  });

  const totals = useMemo(() => {
    let total = 0;
    let paid = 0;
    for (const row of query.data ?? []) {
      total += row.totalCost;
      paid += row.paid;
    }
    return { total, paid, pending: Math.max(0, total - paid) };
  }, [query.data]);

  useEffect(() => {
    if (!enabled || !query.data) {
      onSectionsChange(null);
      return;
    }
    const sections: ReportTableSection[] = [
      {
        name: "NOMINA",
        aoa: [
          ["Periodo", periodLabel],
          ["Empleado", "Total CUP", "Pagado CUP", "Pendiente CUP"],
          ...query.data.map((row) => [row.employeeName, row.totalCost, row.paid, row.pending]),
          ["TOTAL", totals.total, totals.paid, totals.pending],
        ],
      },
    ];
    onSectionsChange(sections);
  }, [enabled, onSectionsChange, periodLabel, query.data, totals]);

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
  if (query.isError) {
    return (
      <div className="alert alert-error">
        <span>No se pudo cargar la nómina.</span>
      </div>
    );
  }

  const rows = query.data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-xs text-base-content/60">
        La nómina y las tarifas de pago a empleados se registran siempre en CUP.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ReportKpiCard label={moneyHeading("Total", "CUP")}>
          <p className="text-2xl font-semibold">{formatAmount(totals.total)}</p>
        </ReportKpiCard>
        <ReportKpiCard label={moneyHeading("Pagado", "CUP")}>
          <p className="text-2xl font-semibold text-success">{formatAmount(totals.paid)}</p>
        </ReportKpiCard>
        <ReportKpiCard label={moneyHeading("Pendiente", "CUP")}>
          <p className="text-2xl font-semibold text-warning">{formatAmount(totals.pending)}</p>
        </ReportKpiCard>
      </div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-base-content/60">
          Sin nómina en este periodo.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Empleado</th>
                <th className="text-right">{moneyHeading("Total", "CUP")}</th>
                <th className="text-right">{moneyHeading("Pagado", "CUP")}</th>
                <th className="text-right">{moneyHeading("Pendiente", "CUP")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employeeId}>
                  <td>{row.employeeName}</td>
                  <td className="text-right tabular-nums">{formatAmount(row.totalCost)}</td>
                  <td className="text-right tabular-nums text-success">{formatAmount(row.paid)}</td>
                  <td className="text-right tabular-nums text-warning">{formatAmount(row.pending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
