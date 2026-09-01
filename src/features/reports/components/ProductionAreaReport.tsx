import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock } from "lucide-react";
import { fetchProductionReport } from "@/db/queries/production";
import { DualPhysicalAmounts, ReportKpiCard } from "@/features/reports/components/ReportKpis";
import type { OperationalReportViewProps } from "@/features/reports/components/report-view-props";
import { formatAmount, formatMoney, moneyHeading } from "@/lib/format-money";
import type { ReportTableSection } from "@/lib/report-export";

/**
 * Informe de producción por área y formato (pedido / realizado / pendiente).
 * El importe de venta se muestra en USD (precio) y CUP (libro); el salario es siempre CUP.
 *
 * @param props - Rango, habilitación y callback de exporte.
 * @returns Vista del informe.
 */
export function ProductionAreaReport(props: OperationalReportViewProps) {
  const { dateFrom, dateTo, enabled, periodLabel, onSectionsChange } = props;
  const query = useQuery({
    queryKey: ["reports", "production", dateFrom, dateTo],
    queryFn: () => fetchProductionReport({ dateFrom, dateTo }),
    enabled,
  });

  const totals = useMemo(() => {
    let pedido = 0;
    let realizado = 0;
    let amountCup = 0;
    let amountUsd = 0;
    let salario = 0;
    for (const area of query.data?.areas ?? []) {
      pedido += area.pedidoQty;
      realizado += area.realizadoQty;
      amountCup += area.pedidoAmount;
      amountUsd += area.pedidoAmountUsd;
      salario += area.salarioAmount;
    }
    return {
      pedido,
      realizado,
      pendiente: Math.max(0, pedido - realizado),
      amountCup,
      amountUsd,
      salario,
      diferencia: amountCup - salario,
    };
  }, [query.data?.areas]);

  useEffect(() => {
    if (!enabled || !query.data) {
      onSectionsChange(null);
      return;
    }
    const sections: ReportTableSection[] = [
      {
        name: "RESUMEN",
        aoa: [
          ["Métrica", "Valor"],
          ["Periodo", periodLabel],
          ["Pedido (uds.)", totals.pedido],
          ["Realizado (uds.)", totals.realizado],
          ["Pendiente (uds.)", totals.pendiente],
          ["Facturado venta (USD)", totals.amountUsd],
          ["Facturado venta (CUP)", totals.amountCup],
          ["Salario (CUP)", totals.salario],
          ["Margen (CUP)", totals.diferencia],
        ],
      },
    ];
    for (const area of query.data.areas) {
      sections.push({
        name: area.area.slice(0, 31),
        aoa: [
          [
            "Formato",
            "Pedido",
            "Realizado",
            "Pendiente",
            "Importe USD",
            "Importe CUP",
            "Salario CUP",
          ],
          ...area.rows.map((row) => [
            row.formatLabel,
            row.pedidoQty,
            row.realizadoQty,
            row.pendienteQty,
            row.pedidoAmountUsd,
            row.pedidoAmount,
            row.salarioAmount,
          ]),
        ],
      });
    }
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
        <span>No se pudo cargar el reporte de producción.</span>
      </div>
    );
  }

  const areas = query.data?.areas ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ReportKpiCard label="Pedido (uds.)">
          <p className="text-2xl font-semibold">{totals.pedido}</p>
        </ReportKpiCard>
        <ReportKpiCard label="Realizado (uds.)">
          <p className="flex items-center gap-2 text-2xl font-semibold text-success">
            <CheckCircle2 className="h-6 w-6" /> {totals.realizado}
          </p>
        </ReportKpiCard>
        <ReportKpiCard label="Pendiente (uds.)">
          <p className="flex items-center gap-2 text-2xl font-semibold text-warning">
            <Clock className="h-6 w-6" /> {totals.pendiente}
          </p>
        </ReportKpiCard>
        <ReportKpiCard label="Importe pedido">
          <DualPhysicalAmounts amountCup={totals.amountCup} amountUsd={totals.amountUsd} />
        </ReportKpiCard>
      </div>

      <div className="rounded-lg border border-base-300 bg-base-100 p-4">
        <h3 className="mb-1 text-sm font-semibold">Factura vs. salario</h3>
        <p className="mb-3 text-xs text-base-content/60">
          Precio de venta en USD y CUP. El salario y el margen se registran solo en CUP.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase text-base-content/60">Facturado</p>
            <DualPhysicalAmounts amountCup={totals.amountCup} amountUsd={totals.amountUsd} />
          </div>
          <div>
            <p className="text-xs uppercase text-base-content/60">{moneyHeading("Salario", "CUP")}</p>
            <p className="text-xl font-semibold">{formatAmount(totals.salario)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-base-content/60">{moneyHeading("Margen", "CUP")}</p>
            <p
              className={`text-xl font-semibold ${totals.diferencia >= 0 ? "text-success" : "text-error"}`}
            >
              {formatAmount(totals.diferencia)}
            </p>
          </div>
        </div>
      </div>

      {areas.length === 0 ? (
        <p className="py-8 text-center text-sm text-base-content/60">
          Sin producción registrada en este periodo.
        </p>
      ) : (
        areas.map((area) => (
          <div key={area.area} className="rounded-lg border border-base-300 bg-base-100 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold capitalize">{area.area}</h3>
              <div className="flex flex-wrap gap-3 text-xs">
                <span>
                  Pedido: <b>{area.pedidoQty}</b>
                </span>
                <span className="text-success">
                  Realizado: <b>{area.realizadoQty}</b>
                </span>
                <span className="text-warning">
                  Pendiente: <b>{area.pendienteQty}</b>
                </span>
                <span>
                  Factura: <b>{formatMoney(area.pedidoAmountUsd, "USD")}</b>
                  {" · "}
                  <b>{formatMoney(area.pedidoAmount, "CUP")}</b>
                </span>
                <span>
                  Salario: <b>{formatMoney(area.salarioAmount, "CUP")}</b>
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Formato</th>
                    <th className="text-right">Pedido</th>
                    <th className="text-right">Realizado</th>
                    <th className="text-right">Pendiente</th>
                    <th className="text-right">{moneyHeading("Importe", "USD")}</th>
                    <th className="text-right">{moneyHeading("Importe", "CUP")}</th>
                  </tr>
                </thead>
                <tbody>
                  {area.rows.map((row) => (
                    <tr key={row.formatLabel}>
                      <td>{row.formatLabel}</td>
                      <td className="text-right">{row.pedidoQty}</td>
                      <td className="text-right text-success">{row.realizadoQty}</td>
                      <td className="text-right text-warning">{row.pendienteQty}</td>
                      <td className="text-right tabular-nums">{formatAmount(row.pedidoAmountUsd)}</td>
                      <td className="text-right tabular-nums">{formatAmount(row.pedidoAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
