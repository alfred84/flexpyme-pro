import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  CircleDollarSign,
  ClipboardList,
  Package,
  Receipt,
} from "lucide-react";
import { fetchIncomeByCategory, fetchReportsSummary } from "@/db/queries/reports";
import { fetchInvoices } from "@/db/queries/invoices";
import { formatMoney } from "@/lib/format-money";
import { useAppSettings } from "@/hooks/use-app-settings";

/**
 * Devuelve la fecha en formato `YYYY-MM-DD`.
 */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Tarjeta KPI del dashboard.
 *
 * @param props - Etiqueta, valor, icono y color de acento.
 * @returns Tarjeta de indicador.
 */
function KpiCard(props: {
  label: string;
  value: string;
  icon: typeof Receipt;
  accent: string;
}) {
  const { label, value, icon: Icon, accent } = props;
  return (
    <div className="card bg-base-200">
      <div className="card-body flex-row items-center gap-4 p-4">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${accent}`}>
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wide text-base-content/60">{label}</p>
          <p className="truncate text-xl font-semibold">{value}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Dashboard principal: KPIs del mes, ingresos por categoría, pedidos recientes y alertas.
 *
 * @returns Página de dashboard.
 */
export function DashboardPage() {
  const settings = useAppSettings();
  const now = new Date();
  const monthStart = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const today = isoDate(now);
  const thirtyDaysAgo = isoDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));

  const summaryQuery = useQuery({
    queryKey: ["reports", "summary", monthStart, today],
    queryFn: () => fetchReportsSummary({ dateFrom: monthStart, dateTo: today }),
  });

  const incomeQuery = useQuery({
    queryKey: ["reports", "income-by-category", thirtyDaysAgo, today],
    queryFn: () => fetchIncomeByCategory({ dateFrom: thirtyDaysAgo, dateTo: today }),
  });

  const invoicesQuery = useQuery({
    queryKey: ["invoices", "list"],
    queryFn: fetchInvoices,
  });

  const summary = summaryQuery.data;
  const invoices = invoicesQuery.data ?? [];

  const recentInvoices = useMemo(
    () => [...invoices].sort((a, b) => b.id - a.id).slice(0, 10),
    [invoices],
  );
  const unpaidCount = invoices.filter((inv) => inv.balance > 0).length;
  const todayCount = invoices.filter((inv) => inv.date === today).length;
  const chartData = (incomeQuery.data ?? []).map((row) => ({ name: row.label, total: row.total }));

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Bienvenido — {settings.businessName}</h2>
        <p className="text-sm text-base-content/60">Resumen del mes en curso</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Facturación del mes"
          value={formatMoney(summary?.totalBilled ?? 0)}
          icon={Receipt}
          accent="bg-primary/15 text-primary"
        />
        <KpiCard
          label="Pedidos pendientes"
          value={String(unpaidCount)}
          icon={ClipboardList}
          accent="bg-warning/15 text-warning"
        />
        <KpiCard
          label="Cobros pendientes"
          value={formatMoney(summary?.totalPending ?? 0)}
          icon={CircleDollarSign}
          accent="bg-error/15 text-error"
        />
        <KpiCard
          label="Facturas de hoy"
          value={String(todayCount)}
          icon={Package}
          accent="bg-success/15 text-success"
        />
      </div>

      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title text-base">Ingresos por categoría (últimos 30 días)</h3>
          {incomeQuery.isLoading ? (
            <div className="h-72 animate-pulse rounded-lg bg-base-300" />
          ) : chartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-base-content/60">Sin datos en el período.</p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} width={70} />
                  <Tooltip formatter={(value) => formatMoney(Number(value))} />
                  <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card bg-base-200 lg:col-span-2">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <h3 className="card-title text-base">Pedidos recientes</h3>
              <Link to="/pedidos" className="btn btn-ghost btn-xs gap-1">
                Ver todos <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Cliente</th>
                    <th>Fecha</th>
                    <th className="text-right">Total</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="max-w-[12rem] truncate">{inv.clientName}</td>
                      <td className="text-xs">{inv.date}</td>
                      <td className="text-right">{formatMoney(inv.total)}</td>
                      <td>
                        <span
                          className={`badge badge-sm ${inv.paymentStatus === "cobrado" ? "badge-success" : "badge-warning"}`}
                        >
                          {inv.paymentStatus === "cobrado" ? "Cobrado" : "Pendiente"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {recentInvoices.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-base-content/60">
                        Sin pedidos todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card bg-base-200">
          <div className="card-body">
            <h3 className="card-title text-base">Alertas</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-warning" />
                <span>
                  <strong>{unpaidCount}</strong> pedidos sin cobrar
                </span>
              </li>
              <li className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-error" />
                <span>
                  <strong>{summary?.clientsWithReceivablesCount ?? 0}</strong> clientes con deuda
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Package className="h-4 w-4 text-info" />
                <span>Control de stock bajo disponible en Inventario</span>
              </li>
            </ul>
            <Link to="/pedidos/nuevo" className="btn btn-primary btn-sm mt-2">
              Nuevo pedido
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
