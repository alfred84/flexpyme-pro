import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Eye, Printer } from "lucide-react";
import { fetchInvoiceMetrics, fetchInvoicesFinancial } from "@/db/queries/invoices";
import { formatDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import {
  invoiceFinancialBadgeClass,
  invoiceFinancialLabel,
  invoiceFinancialStatus,
  type InvoiceFinancialStatus,
} from "@/lib/invoice-financial-status";

type FacturaFilter = "todas" | InvoiceFinancialStatus;

/**
 * Vista financiera/contable de facturas (misma tabla `invoices`, enfoque de cobro).
 *
 * @returns Página del módulo Facturas.
 */
export function FacturasPage() {
  const [filter, setFilter] = useState<FacturaFilter>("todas");
  const [search, setSearch] = useState("");

  const metricsQuery = useQuery({ queryKey: ["invoices", "metrics"], queryFn: fetchInvoiceMetrics });
  const listQuery = useQuery({ queryKey: ["invoices", "financial"], queryFn: fetchInvoicesFinancial });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (listQuery.data ?? []).filter((row) => {
      const fin = invoiceFinancialStatus(row.balance, row.paid, row.status === "anulada");
      if (filter !== "todas" && fin !== filter) return false;
      if (!q) return true;
      return (
        row.invoiceNumber.toLowerCase().includes(q) ||
        row.clientName.toLowerCase().includes(q) ||
        row.date.includes(q)
      );
    });
  }, [listQuery.data, filter, search]);

  const m = metricsQuery.data;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Facturas</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat rounded-lg border border-base-300 bg-base-100 py-3">
          <div className="stat-title text-xs">Total</div>
          <div className="stat-value text-xl">{formatMoney(m?.totalAmount ?? 0)}</div>
          <div className="stat-desc">{m?.totalCount ?? 0} facturas</div>
        </div>
        <div className="stat rounded-lg border border-base-300 bg-base-100 py-3">
          <div className="stat-title text-xs">Cobradas</div>
          <div className="stat-value text-xl text-success">{formatMoney(m?.cobradasAmount ?? 0)}</div>
          <div className="stat-desc">{m?.cobradasCount ?? 0} facturas</div>
        </div>
        <div className="stat rounded-lg border border-base-300 bg-base-100 py-3">
          <div className="stat-title text-xs">Parciales</div>
          <div className="stat-value text-xl text-info">{formatMoney(m?.parcialesAmount ?? 0)}</div>
          <div className="stat-desc">{m?.parcialesCount ?? 0} facturas</div>
        </div>
        <div className="stat rounded-lg border border-base-300 bg-base-100 py-3">
          <div className="stat-title text-xs">Pendientes</div>
          <div className="stat-value text-xl text-warning">{formatMoney(m?.pendientesAmount ?? 0)}</div>
          <div className="stat-desc">{m?.pendientesCount ?? 0} facturas</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["todas", "pendiente", "parcial", "cobrada", "anulada"] as FacturaFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilter(f)}
          >
            {f === "todas" ? "Todas" : invoiceFinancialLabel(f)}
          </button>
        ))}
        <input
          type="search"
          className="input input-bordered input-sm ml-auto w-full max-w-xs"
          placeholder="Buscar factura o cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
        <table className="table table-zebra table-sm">
          <thead>
            <tr>
              <th>Nº factura</th>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {listQuery.isLoading && (
              <tr>
                <td colSpan={6}>Cargando...</td>
              </tr>
            )}
            {!listQuery.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-base-content/60">
                  No hay facturas con este filtro.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const fin = invoiceFinancialStatus(row.balance, row.paid, row.status === "anulada");
              return (
                <tr key={row.id}>
                  <td className="font-mono text-xs">{row.invoiceNumber}</td>
                  <td>{row.clientName}</td>
                  <td>{formatDate(row.date)}</td>
                  <td className="tabular-nums">{formatMoney(row.total)}</td>
                  <td>
                    <span className={`badge badge-sm ${invoiceFinancialBadgeClass(fin)}`}>
                      {invoiceFinancialLabel(fin)}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Link className="btn btn-xs btn-ghost gap-1" to="/facturas/$invoiceId" params={{ invoiceId: String(row.id) }}>
                        <Eye className="h-3 w-3" /> Ver
                      </Link>
                      <Link
                        className="btn btn-xs btn-ghost gap-1"
                        to="/facturas/$invoiceId/imprimir"
                        params={{ invoiceId: String(row.id) }}
                      >
                        <Printer className="h-3 w-3" /> Imprimir
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
