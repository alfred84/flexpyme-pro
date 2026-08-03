import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Eye, Printer } from "lucide-react";
import { DualMoneyText } from "@/components/common/DualMoneyText";
import { fetchInvoiceMetrics, fetchInvoicesFinancial } from "@/db/queries/invoices";
import { useAppSettings } from "@/hooks/use-app-settings";
import { cupToUsd } from "@/lib/currency";
import { formatDate } from "@/lib/format-date";
import { formatAmount, moneyHeading } from "@/lib/format-money";
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
  const { usdExchangeRate } = useAppSettings();
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
  const rate = usdExchangeRate;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Facturas</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat rounded-lg border border-base-300 bg-base-100 py-3">
          <div className="stat-title text-xs">{moneyHeading("Total", "USD")}</div>
          <div className="stat-value text-xl">
            <DualMoneyText
              amountCup={m?.totalAmount ?? 0}
              rate={rate}
              primary="USD"
              className="items-start"
            />
          </div>
          <div className="stat-desc">{m?.totalCount ?? 0} facturas</div>
        </div>
        <div className="stat rounded-lg border border-base-300 bg-base-100 py-3">
          <div className="stat-title text-xs">{moneyHeading("Cobradas", "USD")}</div>
          <div className="stat-value text-xl text-success">
            <DualMoneyText
              amountCup={m?.cobradasAmount ?? 0}
              rate={rate}
              primary="USD"
              className="items-start"
            />
          </div>
          <div className="stat-desc">{m?.cobradasCount ?? 0} facturas</div>
        </div>
        <div className="stat rounded-lg border border-base-300 bg-base-100 py-3">
          <div className="stat-title text-xs">{moneyHeading("Parciales", "USD")}</div>
          <div className="stat-value text-xl text-info">
            <DualMoneyText
              amountCup={m?.parcialesAmount ?? 0}
              rate={rate}
              primary="USD"
              className="items-start"
            />
          </div>
          <div className="stat-desc">{m?.parcialesCount ?? 0} facturas</div>
        </div>
        <div className="stat rounded-lg border border-base-300 bg-base-100 py-3">
          <div className="stat-title text-xs">{moneyHeading("Pendientes", "USD")}</div>
          <div className="stat-value text-xl text-warning">
            <DualMoneyText
              amountCup={m?.pendientesAmount ?? 0}
              rate={rate}
              primary="USD"
              className="items-start"
            />
          </div>
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
              <th className="text-right">{moneyHeading("Total", "USD")}</th>
              <th className="text-right">{moneyHeading("Total", "CUP")}</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {listQuery.isLoading && (
              <tr>
                <td colSpan={7}>Cargando...</td>
              </tr>
            )}
            {!listQuery.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-base-content/60">
                  No hay facturas con este filtro.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const fin = invoiceFinancialStatus(row.balance, row.paid, row.status === "anulada");
              const rowRate =
                row.exchangeRateSnapshot && row.exchangeRateSnapshot > 0
                  ? row.exchangeRateSnapshot
                  : rate;
              const paidInCup = (row.paymentCurrency ?? "").toUpperCase() === "CUP";
              return (
                <tr key={row.id}>
                  <td className="font-mono text-xs">{row.invoiceNumber}</td>
                  <td>{row.clientName}</td>
                  <td>{formatDate(row.date)}</td>
                  <td className="text-right tabular-nums">{formatAmount(cupToUsd(row.total, rowRate))}</td>
                  <td className="text-right tabular-nums">
                    {paidInCup ? formatAmount(row.total) : "—"}
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
    </section>
  );
}
