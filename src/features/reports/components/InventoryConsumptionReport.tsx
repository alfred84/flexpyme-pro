import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchInventoryConsumptionInRange } from "@/db/queries/inventory";
import {
  formatConsumptionQty,
  groupConsumptionByCategory,
} from "@/features/inventory/lib/consumption-summary";
import { ReportKpiCard } from "@/features/reports/components/ReportKpis";
import type { OperationalReportViewProps } from "@/features/reports/components/report-view-props";
import type { InventoryConsumptionRowDto } from "@/types/inventory";
import type { ReportTableSection } from "@/lib/report-export";

const EPS = 1e-9;

const CONSUMPTION_HEADERS = [
  "Formato",
  "Unidad",
  "Existencia inicial",
  "Entradas",
  "Salidas",
  "Solicitados",
  "Mermas",
  "Ventas",
  "Existencia final",
  "Demanda",
  "Déficit",
  "Disponible",
];

/**
 * Convierte una fila de kardex a celdas de exporte.
 *
 * @param row - Ítem de inventario.
 * @returns Valores en el orden de `CONSUMPTION_HEADERS`.
 */
function consumptionExportRow(row: InventoryConsumptionRowDto): (string | number)[] {
  return [
    row.formato,
    row.unit,
    row.existenciaInicial,
    row.entradas,
    row.salidas,
    row.solicitados,
    row.mermas,
    row.ventas,
    row.existenciaFinal,
    row.demanda,
    row.deficit,
    row.disponible,
  ];
}

/**
 * Informe de consumo de materiales (kardex por tipo) en el periodo del hub.
 *
 * @param props - Rango, habilitación y callback de exporte.
 * @returns Vista del informe.
 */
export function InventoryConsumptionReport(props: OperationalReportViewProps) {
  const { dateFrom, dateTo, enabled, periodLabel, onSectionsChange } = props;
  const query = useQuery({
    queryKey: ["reports", "inventory-consumption", dateFrom, dateTo],
    queryFn: () => fetchInventoryConsumptionInRange({ dateFrom, dateTo }),
    enabled,
  });

  const groups = useMemo(
    () => groupConsumptionByCategory(query.data ?? []),
    [query.data],
  );

  const kpis = useMemo(() => {
    let entradas = 0;
    let mermas = 0;
    let ventas = 0;
    let deficitItems = 0;
    for (const row of query.data ?? []) {
      entradas += row.entradas;
      mermas += row.mermas;
      ventas += row.ventas;
      if (row.deficit > EPS) {
        deficitItems += 1;
      }
    }
    return { entradas, mermas, ventas, deficitItems };
  }, [query.data]);

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
          ["Entradas", kpis.entradas],
          ["Mermas", kpis.mermas],
          ["Ventas", kpis.ventas],
          ["Ítems con déficit", kpis.deficitItems],
        ],
      },
    ];
    for (const group of groups) {
      sections.push({
        name: group.materialCategoryName.slice(0, 31),
        aoa: [
          CONSUMPTION_HEADERS,
          ...group.rows.map(consumptionExportRow),
          [
            "Total",
            "",
            group.totals.existenciaInicial,
            group.totals.entradas,
            group.totals.salidas,
            group.totals.solicitados,
            group.totals.mermas,
            group.totals.ventas,
            group.totals.existenciaFinal,
            group.totals.demanda,
            group.totals.deficit,
            group.totals.disponible,
          ],
        ],
      });
    }
    onSectionsChange(sections);
  }, [enabled, groups, kpis, onSectionsChange, periodLabel, query.data]);

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
        <span>No se pudo cargar el consumo de materiales.</span>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-base-content/60">
        No hay materiales de inventario para este periodo.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <ReportKpiCard label="Entradas">
          <p className="text-2xl font-semibold text-success">{formatConsumptionQty(kpis.entradas)}</p>
        </ReportKpiCard>
        <ReportKpiCard label="Mermas">
          <p className="text-2xl font-semibold text-warning">{formatConsumptionQty(kpis.mermas)}</p>
        </ReportKpiCard>
        <ReportKpiCard label="Ventas">
          <p className="text-2xl font-semibold">{formatConsumptionQty(kpis.ventas)}</p>
        </ReportKpiCard>
        <ReportKpiCard label="Ítems con déficit">
          <p className={`text-2xl font-semibold ${kpis.deficitItems > 0 ? "text-error" : ""}`}>
            {kpis.deficitItems}
          </p>
        </ReportKpiCard>
      </div>

      <div className="space-y-4">
        {groups.map((group) => (
          <article
            key={group.materialCategoryId ?? "none"}
            className="rounded-lg border border-base-300 bg-base-100"
          >
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-base-200 px-4 py-3">
              <h3 className="text-sm font-semibold">{group.materialCategoryName}</h3>
              <div className="flex flex-wrap gap-3 text-xs text-base-content/70">
                <span>
                  {group.rows.length} formato{group.rows.length === 1 ? "" : "s"}
                </span>
                <span>
                  Stock: <b>{formatConsumptionQty(group.totals.existenciaFinal)}</b>
                </span>
                {group.totals.deficit > EPS ? (
                  <span className="text-error">
                    Déficit: <b>{formatConsumptionQty(group.totals.deficit)}</b>
                  </span>
                ) : null}
              </div>
            </header>
            <div className="overflow-x-auto p-3">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Formato</th>
                    <th className="text-right">Inicial</th>
                    <th className="text-right">Entradas</th>
                    <th className="text-right">Salidas</th>
                    <th className="text-right">Mermas</th>
                    <th className="text-right">Ventas</th>
                    <th className="text-right">Final</th>
                    <th className="text-right">Déficit</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={row.itemId} className={row.deficit > EPS ? "bg-error/10" : undefined}>
                      <td className="whitespace-nowrap">
                        {row.formato}
                        {row.unit ? (
                          <span className="ml-1 text-[10px] text-base-content/50">{row.unit}</span>
                        ) : null}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatConsumptionQty(row.existenciaInicial)}
                      </td>
                      <td className="text-right tabular-nums text-success">
                        {formatConsumptionQty(row.entradas)}
                      </td>
                      <td className="text-right tabular-nums">{formatConsumptionQty(row.salidas)}</td>
                      <td className="text-right tabular-nums text-warning">
                        {formatConsumptionQty(row.mermas)}
                      </td>
                      <td className="text-right tabular-nums">{formatConsumptionQty(row.ventas)}</td>
                      <td className="text-right tabular-nums">
                        {formatConsumptionQty(row.existenciaFinal)}
                      </td>
                      <td
                        className={`text-right tabular-nums ${row.deficit > EPS ? "font-semibold text-error" : ""}`}
                      >
                        {formatConsumptionQty(row.deficit)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-base-200/80 font-semibold">
                    <td>Total</td>
                    <td className="text-right tabular-nums">
                      {formatConsumptionQty(group.totals.existenciaInicial)}
                    </td>
                    <td className="text-right tabular-nums text-success">
                      {formatConsumptionQty(group.totals.entradas)}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatConsumptionQty(group.totals.salidas)}
                    </td>
                    <td className="text-right tabular-nums text-warning">
                      {formatConsumptionQty(group.totals.mermas)}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatConsumptionQty(group.totals.ventas)}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatConsumptionQty(group.totals.existenciaFinal)}
                    </td>
                    <td
                      className={`text-right tabular-nums ${group.totals.deficit > EPS ? "text-error" : ""}`}
                    >
                      {formatConsumptionQty(group.totals.deficit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
