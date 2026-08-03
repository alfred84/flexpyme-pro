import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PaymentStatusBadge } from "@/components/invoices/InvoiceStatusBadges";
import { fetchStockItems, fetchStockMetrics } from "@/db/queries/stock";
import { formatAmount, moneyHeading } from "@/lib/format-money";

type StockFilter = "todos" | "sin_cobrar" | "cobrados";

/**
 * Vista de pedidos listos para entrega (bandeja de salida del taller).
 *
 * @returns Página del módulo Stock.
 */
export function StockPage() {
  const [filter, setFilter] = useState<StockFilter>("todos");
  const [search, setSearch] = useState("");

  const metricsQuery = useQuery({
    queryKey: ["stock", "metrics"],
    queryFn: fetchStockMetrics,
  });
  const itemsQuery = useQuery({
    queryKey: ["stock", "items", filter],
    queryFn: () =>
      fetchStockItems(filter === "todos" ? null : filter === "sin_cobrar" ? "pendiente" : "cobrado"),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (itemsQuery.data ?? []).filter((row) => {
      if (!q) return true;
      return (
        row.invoiceNumber.toLowerCase().includes(q) ||
        row.clientName.toLowerCase().includes(q) ||
        row.productsSummary.toLowerCase().includes(q)
      );
    });
  }, [itemsQuery.data, search]);

  const metrics = metricsQuery.data;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Stock — Trabajos listos para entrega</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat rounded-lg border border-base-300 bg-base-100 py-3">
          <div className="stat-title text-xs">Listos</div>
          <div className="stat-value text-2xl">{metrics?.totalListo ?? "—"}</div>
        </div>
        <div className="stat rounded-lg border border-base-300 bg-base-100 py-3">
          <div className="stat-title text-xs">Cobrados</div>
          <div className="stat-value text-2xl text-success">{metrics?.cobrado ?? "—"}</div>
        </div>
        <div className="stat rounded-lg border border-base-300 bg-base-100 py-3">
          <div className="stat-title text-xs">Sin cobrar</div>
          <div className="stat-value text-2xl text-warning">{metrics?.sinCobrar ?? "—"}</div>
        </div>
        <div className="stat rounded-lg border border-base-300 bg-base-100 py-3">
          <div className="stat-title text-xs">Tiempo medio</div>
          <div className="stat-value text-2xl">{(metrics?.avgDaysWaiting ?? 0).toFixed(1)} d</div>
        </div>
      </div>

      {(metrics?.staleCount ?? 0) > 0 && (
        <div className="alert alert-warning py-2 text-sm">
          <span>Hace más de 7 días sin retirar: {metrics?.staleCount} pedido(s).</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(["todos", "sin_cobrar", "cobrados"] as StockFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilter(f)}
          >
            {f === "todos" ? "Todos" : f === "sin_cobrar" ? "Sin cobrar" : "Cobrados"}
          </button>
        ))}
        <input
          type="search"
          className="input input-bordered input-sm ml-auto w-full max-w-xs"
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
        <table className="table table-zebra table-sm">
          <thead>
            <tr>
              <th>Nº pedido</th>
              <th>Cliente</th>
              <th>Productos</th>
              <th>Listo desde</th>
              <th>Cobro</th>
              <th>{moneyHeading("Total")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {itemsQuery.isLoading && (
              <tr>
                <td colSpan={7}>Cargando...</td>
              </tr>
            )}
            {!itemsQuery.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-base-content/60">
                  No hay pedidos listos para entrega.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className={row.daysWaiting >= 7 ? "bg-warning/10" : undefined}>
                <td className="font-mono text-xs">{row.invoiceNumber}</td>
                <td>{row.clientName}</td>
                <td className="max-w-xs truncate text-sm">{row.productsSummary}</td>
                <td>
                  {row.daysWaiting === 0 ? "Hoy" : row.daysWaiting === 1 ? "Hace 1 día" : `Hace ${row.daysWaiting} días`}
                </td>
                <td>
                  <PaymentStatusBadge status={row.paymentStatus} />
                </td>
                <td className="tabular-nums">{formatAmount(row.total)}</td>
                <td>
                  <div className="flex gap-1">
                    <Link className="btn btn-xs btn-ghost" to="/stock/$invoiceId" params={{ invoiceId: String(row.id) }}>
                      Ver
                    </Link>
                    {row.paymentStatus === "pendiente" && row.balance > 1e-6 && (
                      <Link className="btn btn-xs btn-primary" to="/pedidos/$invoiceId/caja" params={{ invoiceId: String(row.id) }}>
                        Cobrar
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
