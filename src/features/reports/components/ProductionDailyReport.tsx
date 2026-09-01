import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchProductionReport } from "@/db/queries/production";
import type { OperationalReportViewProps } from "@/features/reports/components/report-view-props";
import { formatDate } from "@/lib/format-date";
import type { ReportTableSection } from "@/lib/report-export";

/**
 * Control diario de unidades realizadas por área.
 *
 * @param props - Rango, habilitación y callback de exporte.
 * @returns Vista del informe.
 */
export function ProductionDailyReport(props: OperationalReportViewProps) {
  const { dateFrom, dateTo, enabled, periodLabel, onSectionsChange } = props;
  const query = useQuery({
    queryKey: ["reports", "production", dateFrom, dateTo],
    queryFn: () => fetchProductionReport({ dateFrom, dateTo }),
    enabled,
  });

  const dailyByDate = useMemo(() => {
    const map = new Map<string, { total: number; areas: Map<string, number> }>();
    for (const point of query.data?.daily ?? []) {
      const entry = map.get(point.date) ?? { total: 0, areas: new Map() };
      entry.total += point.realizadoQty;
      entry.areas.set(point.area, (entry.areas.get(point.area) ?? 0) + point.realizadoQty);
      map.set(point.date, entry);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [query.data?.daily]);

  useEffect(() => {
    if (!enabled || !query.data) {
      onSectionsChange(null);
      return;
    }
    const sections: ReportTableSection[] = [
      {
        name: "METADATOS",
        aoa: [
          ["Campo", "Valor"],
          ["Periodo", periodLabel],
        ],
      },
      {
        name: "CONTROL_DIARIO",
        aoa: [
          ["Día", "Áreas", "Total realizado"],
          ...dailyByDate.map(([date, entry]) => [
            date,
            [...entry.areas.entries()].map(([area, qty]) => `${area}: ${qty}`).join(" · "),
            entry.total,
          ]),
        ],
      },
    ];
    onSectionsChange(sections);
  }, [dailyByDate, enabled, onSectionsChange, periodLabel, query.data]);

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
        <span>No se pudo cargar el control diario.</span>
      </div>
    );
  }

  if (dailyByDate.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-base-content/60">
        Sin producción diaria en este periodo.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Día</th>
            <th>Áreas</th>
            <th className="text-right">Total realizado</th>
          </tr>
        </thead>
        <tbody>
          {dailyByDate.map(([date, entry]) => (
            <tr key={date}>
              <td>{formatDate(date)}</td>
              <td className="text-xs">
                {[...entry.areas.entries()]
                  .map(([area, qty]) => `${area}: ${qty}`)
                  .join(" · ")}
              </td>
              <td className="text-right font-semibold">{entry.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
