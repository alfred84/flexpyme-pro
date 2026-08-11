import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Eye, Printer } from "lucide-react";
import { TablePagination } from "@/components/common/TablePagination";
import { fetchInvoiceMetrics, fetchInvoicesFinancial } from "@/db/queries/invoices";
import {
  formatInvoiceAmountOrDash,
  resolveInvoiceDualAmounts,
} from "@/features/invoices/lib/invoice-dual-amounts";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { formatDate } from "@/lib/format-date";
import { formatAmount, moneyHeading } from "@/lib/format-money";
import {
  invoiceFinancialBadgeClass,
  invoiceFinancialLabel,
  invoiceFinancialStatus,
  type InvoiceFinancialStatus,
} from "@/lib/invoice-financial-status";

type FacturaFilter = "todas" | InvoiceFinancialStatus;

interface DualKpiPanelProps {
  /** Título del panel. */
  title: string;
  /** Importe CUP. */
  amountCup: number;
  /** Importe USD. */
  amountUsd: number;
  /** Cantidad de facturas. */
  count: number;
  /** Clase del valor (p. ej. text-success). */
  valueClassName?: string;
  /** Si está cargando. */
  loading?: boolean;
}

/**
 * Panel KPI de Facturas con CUP a la izquierda y USD a la derecha (montos reales).
 *
 * @param props - Título, importes y conteo.
 * @returns Bloque compacto dual.
 */
function DualKpiPanel(props: DualKpiPanelProps) {
  const { title, amountCup, amountUsd, count, valueClassName = "", loading } = props;
  return (
    <div className="rounded-lg border border-base-300 bg-base-100 p-3">
      <p className="text-xs uppercase text-base-content/60">{title}</p>
      {loading ? (
        <span className="loading loading-spinner loading-sm mt-2" />
      ) : (
        <div className="mt-1 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-base-content/50">{moneyHeading("Importe", "CUP")}</p>
            <p className={`text-xl font-semibold tabular-nums ${valueClassName}`}>
              {formatAmount(amountCup)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-base-content/50">{moneyHeading("Importe", "USD")}</p>
            <p className={`text-xl font-semibold tabular-nums ${valueClassName}`}>
              {formatAmount(amountUsd)}
            </p>
          </div>
        </div>
      )}
      <p className="mt-1 text-xs text-base-content/60">{count} facturas</p>
    </div>
  );
}

/**
 * Vista financiera de facturas con KPIs de cobro real CUP/USD (sin conversión).
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

  const paginationResetKey = `${filter}|${search.trim().toLowerCase()}`;
  const { pagination, onPaginationChange } = useClientPagination({
    resetKey: paginationResetKey,
    itemCount: rows.length,
  });

  const pageRows = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    return rows.slice(start, start + pagination.pageSize);
  }, [rows, pagination.pageIndex, pagination.pageSize]);

  const m = metricsQuery.data;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Facturas</h1>
        <p className="text-sm text-base-content/70">
          Importes reales a cobrar o cobrados en cada moneda (no conversión por tasa).
        </p>
      </div>

      {metricsQuery.isError && (
        <div className="alert alert-error py-2 text-sm">
          <span>No se pudieron cargar los indicadores de facturas.</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DualKpiPanel
          title="Total facturado"
          amountCup={m?.totalAmountCup ?? 0}
          amountUsd={m?.totalAmountUsd ?? 0}
          count={m?.totalCount ?? 0}
          loading={metricsQuery.isLoading}
        />
        <DualKpiPanel
          title="Cobradas"
          amountCup={m?.cobradasAmountCup ?? 0}
          amountUsd={m?.cobradasAmountUsd ?? 0}
          count={m?.cobradasCount ?? 0}
          valueClassName="text-success"
          loading={metricsQuery.isLoading}
        />
        <DualKpiPanel
          title="Parciales (saldo)"
          amountCup={m?.parcialesAmountCup ?? 0}
          amountUsd={m?.parcialesAmountUsd ?? 0}
          count={m?.parcialesCount ?? 0}
          valueClassName="text-info"
          loading={metricsQuery.isLoading}
        />
        <DualKpiPanel
          title="Pendientes (saldo)"
          amountCup={m?.pendientesAmountCup ?? 0}
          amountUsd={m?.pendientesAmountUsd ?? 0}
          count={m?.pendientesCount ?? 0}
          valueClassName="text-warning"
          loading={metricsQuery.isLoading}
        />
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
              <th className="text-right">{moneyHeading("Total", "USD")}</th>
              <th className="text-right">{moneyHeading("Total", "CUP")}</th>
              <th className="text-right">Tasa</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {listQuery.isLoading && (
              <tr>
                <td colSpan={8}>Cargando...</td>
              </tr>
            )}
            {!listQuery.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-base-content/60">
                  No hay facturas con este filtro.
                </td>
              </tr>
            )}
            {pageRows.map((row) => {
              const fin = invoiceFinancialStatus(row.balance, row.paid, row.status === "anulada");
              const dual = resolveInvoiceDualAmounts(row);
              return (
                <tr key={row.id}>
                  <td className="font-mono text-xs">{row.invoiceNumber}</td>
                  <td>{row.clientName}</td>
                  <td>{formatDate(row.date)}</td>
                  <td className="text-right tabular-nums">
                    {formatInvoiceAmountOrDash(dual.dueUsd, formatAmount)}
                  </td>
                  <td className="text-right tabular-nums">
                    {formatInvoiceAmountOrDash(dual.dueCup, formatAmount)}
                  </td>
                  <td className="text-right tabular-nums">
                    {dual.rate > 0 ? formatAmount(dual.rate) : "—"}
                  </td>
                  <td>
                    <span className={`badge badge-sm ${invoiceFinancialBadgeClass(fin)}`}>
                      {invoiceFinancialLabel(fin)}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Link
                        className="btn btn-xs btn-ghost gap-1"
                        to="/facturas/$invoiceId"
                        params={{ invoiceId: String(row.id) }}
                      >
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

      {!listQuery.isLoading && (
        <TablePagination
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          totalItems={rows.length}
          onPageChange={(pageIndex) =>
            onPaginationChange((prev) => ({ ...prev, pageIndex }))
          }
          onPageSizeChange={(pageSize) =>
            onPaginationChange((prev) => ({ ...prev, pageSize, pageIndex: 0 }))
          }
          label="Paginación de facturas"
        />
      )}
    </section>
  );
}
