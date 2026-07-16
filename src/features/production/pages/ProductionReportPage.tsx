import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, Clock } from "lucide-react";
import { fetchProductionReportMonthly } from "@/db/queries/production";
import { formatDate, todayIso } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";

/**
 * Devuelve el mes en curso en formato `YYYY-MM`.
 *
 * @returns Mes actual (`YYYY-MM`).
 */
function currentMonth(): string {
  return todayIso().slice(0, 7);
}

/**
 * Reportes de producción: trabajo realizado por Área (Impresión, Laminado,
 * Enmarcado) con Pedido vs Realizado vs Pendiente por formato y control diario
 * del mes en curso.
 *
 * @returns Página de reportes de producción.
 */
export function ProductionReportPage() {
  const [month, setMonth] = useState(currentMonth);
  const reportQuery = useQuery({
    queryKey: ["production-report", month],
    queryFn: () => fetchProductionReportMonthly(month),
  });

  const report = reportQuery.data;

  const dailyByDate = useMemo(() => {
    const map = new Map<string, { total: number; areas: Map<string, number> }>();
    for (const point of report?.daily ?? []) {
      const entry = map.get(point.date) ?? { total: 0, areas: new Map() };
      entry.total += point.realizadoQty;
      entry.areas.set(point.area, (entry.areas.get(point.area) ?? 0) + point.realizadoQty);
      map.set(point.date, entry);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [report?.daily]);

  const totals = useMemo(() => {
    let pedido = 0;
    let realizado = 0;
    let amount = 0;
    for (const area of report?.areas ?? []) {
      pedido += area.pedidoQty;
      realizado += area.realizadoQty;
      amount += area.pedidoAmount;
    }
    return { pedido, realizado, pendiente: Math.max(0, pedido - realizado), amount };
  }, [report?.areas]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BarChart3 className="h-6 w-6" /> Reportes de producción
        </h1>
        <label className="form-control">
          <span className="label-text text-xs">Mes</span>
          <input
            type="month"
            className="input input-bordered input-sm"
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <p className="text-xs uppercase text-base-content/60">Pedido (uds.)</p>
            <p className="text-2xl font-semibold">{totals.pedido}</p>
          </div>
        </div>
        <div className="card bg-base-200">
          <div className="card-body flex-row items-center gap-3 p-4">
            <CheckCircle2 className="h-8 w-8 text-success" />
            <div>
              <p className="text-xs uppercase text-base-content/60">Realizado (uds.)</p>
              <p className="text-lg font-semibold">{totals.realizado}</p>
            </div>
          </div>
        </div>
        <div className="card bg-base-200">
          <div className="card-body flex-row items-center gap-3 p-4">
            <Clock className="h-8 w-8 text-warning" />
            <div>
              <p className="text-xs uppercase text-base-content/60">Pendiente (uds.)</p>
              <p className="text-lg font-semibold">{totals.pendiente}</p>
            </div>
          </div>
        </div>
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <p className="text-xs uppercase text-base-content/60">Importe pedido</p>
            <p className="text-2xl font-semibold">{formatMoney(totals.amount)}</p>
          </div>
        </div>
      </div>

      {reportQuery.isLoading ? (
        <div className="h-40 animate-pulse rounded-lg bg-base-200" />
      ) : (report?.areas.length ?? 0) === 0 ? (
        <p className="py-10 text-center text-sm text-base-content/60">
          Sin producción registrada en el mes seleccionado.
        </p>
      ) : (
        <div className="space-y-4">
          {report?.areas.map((area) => (
            <div key={area.area} className="card bg-base-100 shadow-sm">
              <div className="card-body gap-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="card-title text-base capitalize">{area.area}</h2>
                  <div className="flex gap-3 text-xs">
                    <span>Pedido: <b>{area.pedidoQty}</b></span>
                    <span className="text-success">Realizado: <b>{area.realizadoQty}</b></span>
                    <span className="text-warning">Pendiente: <b>{area.pendienteQty}</b></span>
                    <span>Importe: <b>{formatMoney(area.pedidoAmount)}</b></span>
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
                        <th className="text-right">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {area.rows.map((row) => (
                        <tr key={row.formatLabel}>
                          <td>{row.formatLabel}</td>
                          <td className="text-right">{row.pedidoQty}</td>
                          <td className="text-right text-success">{row.realizadoQty}</td>
                          <td className="text-right text-warning">{row.pendienteQty}</td>
                          <td className="text-right font-mono text-xs">{formatMoney(row.pedidoAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-2 p-4">
          <h2 className="card-title text-base">Control diario (realizado)</h2>
          {dailyByDate.length === 0 ? (
            <p className="py-6 text-center text-sm text-base-content/60">Sin producción diaria en el mes.</p>
          ) : (
            <div className="overflow-x-auto">
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
          )}
        </div>
      </div>
    </section>
  );
}
