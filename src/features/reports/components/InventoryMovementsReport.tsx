import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchInventoryMovementsInRange } from "@/db/queries/inventory";
import { formatConsumptionQty } from "@/features/inventory/lib/consumption-summary";
import { ReportKpiCard } from "@/features/reports/components/ReportKpis";
import type { OperationalReportViewProps } from "@/features/reports/components/report-view-props";
import { formatDate } from "@/lib/format-date";
import type { ReportTableSection } from "@/lib/report-export";

/**
 * Etiqueta de tipo de movimiento para la UI.
 *
 * @param type - `entrada` | `salida`.
 * @returns Texto en español.
 */
function movementTypeLabel(type: string): string {
  if (type === "entrada") {
    return "Entrada";
  }
  if (type === "salida") {
    return "Salida";
  }
  return type;
}

/**
 * Informe de movimientos de almacén en el periodo del hub.
 *
 * @param props - Rango, habilitación y callback de exporte.
 * @returns Vista del informe.
 */
export function InventoryMovementsReport(props: OperationalReportViewProps) {
  const { dateFrom, dateTo, enabled, periodLabel, onSectionsChange } = props;
  const query = useQuery({
    queryKey: ["reports", "inventory-movements", dateFrom, dateTo],
    queryFn: () => fetchInventoryMovementsInRange({ dateFrom, dateTo }),
    enabled,
  });

  const rows = query.data ?? [];

  const kpis = useMemo(() => {
    let entradas = 0;
    let salidas = 0;
    let mermas = 0;
    let ventas = 0;
    for (const row of rows) {
      if (row.movementType === "entrada") {
        entradas += row.quantity;
      } else if (row.movementType === "salida") {
        salidas += row.quantity;
        if (row.method === "Merma") {
          mermas += row.quantity;
        } else if (row.method === "Venta") {
          ventas += row.quantity;
        }
      }
    }
    return { entradas, salidas, mermas, ventas, count: rows.length };
  }, [rows]);

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
          ["Movimientos", kpis.count],
          ["Entradas", kpis.entradas],
          ["Salidas", kpis.salidas],
          ["Mermas", kpis.mermas],
          ["Ventas", kpis.ventas],
        ],
      },
      {
        name: "MOVIMIENTOS",
        aoa: [
          ["Fecha", "Material", "Tipo", "Cantidad", "Motivo", "Método"],
          ...rows.map((row) => [
            row.date,
            row.itemName,
            movementTypeLabel(row.movementType),
            row.quantity,
            row.reason ?? "",
            row.method,
          ]),
        ],
      },
    ];
    onSectionsChange(sections);
  }, [enabled, kpis, onSectionsChange, periodLabel, query.data, rows]);

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
        <span>No se pudieron cargar los movimientos de inventario.</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-base-content/60">
        No hay movimientos de inventario en este periodo.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <ReportKpiCard label="Entradas">
          <p className="text-2xl font-semibold text-success">
            {formatConsumptionQty(kpis.entradas)}
          </p>
        </ReportKpiCard>
        <ReportKpiCard label="Salidas">
          <p className="text-2xl font-semibold">{formatConsumptionQty(kpis.salidas)}</p>
        </ReportKpiCard>
        <ReportKpiCard label="Mermas">
          <p className="text-2xl font-semibold text-warning">{formatConsumptionQty(kpis.mermas)}</p>
        </ReportKpiCard>
        <ReportKpiCard label="Ventas de material">
          <p className="text-2xl font-semibold">{formatConsumptionQty(kpis.ventas)}</p>
        </ReportKpiCard>
      </div>

      <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Material</th>
              <th>Tipo</th>
              <th className="text-right">Cantidad</th>
              <th>Motivo</th>
              <th>Método</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap text-xs">{formatDate(row.date)}</td>
                <td>{row.itemName}</td>
                <td>{movementTypeLabel(row.movementType)}</td>
                <td className="text-right tabular-nums">{formatConsumptionQty(row.quantity)}</td>
                <td className="text-xs text-base-content/70">{row.reason ?? "—"}</td>
                <td>{row.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
