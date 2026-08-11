import { useMemo, type ReactNode } from "react";
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
  DatabaseBackup,
  Package,
  Receipt,
} from "lucide-react";
import { DualMoneyText } from "@/components/common/DualMoneyText";
import { fetchIncomeByCategory, fetchReportsSummary } from "@/db/queries/reports";
import { fetchInvoices } from "@/db/queries/invoices";
import { fetchBackupOverview } from "@/db/queries/settings";
import { useAppSettings } from "@/hooks/use-app-settings";
import { cupToUsd } from "@/lib/currency";
import { formatDate, formatDateTime, todayIso } from "@/lib/format-date";
import { formatAmount, formatMoney, moneyHeading } from "@/lib/format-money";
import { pedidosListSearch } from "@/lib/pedidos-search";

/**
 * Devuelve una fecha en formato `YYYY-MM-DD` (calendario local).
 *
 * @param date - Fecha a formatear.
 * @returns Cadena ISO de solo fecha.
 */
function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Tarjeta KPI del dashboard.
 *
 * @param props - Etiqueta, valor, icono y color de acento.
 * @returns Tarjeta de indicador.
 */
function KpiCard(props: {
  label: string;
  value: ReactNode;
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
          <div className="text-xl font-semibold leading-tight">{value}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Pantalla de Inicio: KPIs del mes, ingresos por categoría, pedidos recientes y alertas.
 *
 * @returns Página de inicio.
 */
export function DashboardPage() {
  const settings = useAppSettings();
  const rate = settings.usdExchangeRate;
  const moneyPrimary = rate > 0 ? ("USD" as const) : ("CUP" as const);

  const now = new Date();
  const monthStart = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const today = todayIso();
  const thirtyDaysAgo = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30));

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

  const backupOverviewQuery = useQuery({
    queryKey: ["settings", "backup-overview"],
    queryFn: fetchBackupOverview,
  });

  const summary = summaryQuery.data;
  const invoices = invoicesQuery.data ?? [];

  const recentInvoices = useMemo(
    () => [...invoices].sort((a, b) => b.id - a.id).slice(0, 5),
    [invoices],
  );
  const unpaidCount = invoices.filter((inv) => inv.balance > 0).length;
  const todayCount = invoices.filter((inv) => inv.date === today).length;

  const chartData = useMemo(
    () =>
      (incomeQuery.data ?? []).map((row) => ({
        name: row.label,
        /** Valor del eje (USD si hay tasa; si no, CUP del libro). */
        total: rate > 0 ? cupToUsd(row.total, rate) : row.total,
        totalCup: row.total,
      })),
    [incomeQuery.data, rate],
  );

  const backups = backupOverviewQuery.data?.backups ?? [];

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Bienvenido — {settings.businessName}</h2>
        <p className="text-sm text-base-content/60">Resumen del mes en curso</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={moneyHeading("Facturación del mes", moneyPrimary)}
          value={
            <DualMoneyText
              amountCup={summary?.totalBilled ?? 0}
              rate={rate}
              primary="USD"
              className="items-start"
            />
          }
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
          label={moneyHeading("Cobros pendientes", moneyPrimary)}
          value={
            <DualMoneyText
              amountCup={summary?.totalPending ?? 0}
              rate={rate}
              primary="USD"
              className="items-start"
            />
          }
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
          <h3 className="card-title text-base">
            {moneyHeading("Ingresos por categoría (últimos 30 días)", moneyPrimary)}
          </h3>
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
                  <YAxis
                    tick={{ fontSize: 12 }}
                    width={80}
                    tickFormatter={(value: number) => formatAmount(Number(value))}
                  />
                  <Tooltip
                    formatter={(value, _name, item) => {
                      const cup = Number(
                        (item?.payload as { totalCup?: number } | undefined)?.totalCup ?? value,
                      );
                      if (rate > 0) {
                        return [
                          `${formatMoney(Number(value), "USD")} (${formatMoney(cup, "CUP")})`,
                          "Importe",
                        ];
                      }
                      return [formatMoney(cup, "CUP"), "Importe"];
                    }}
                  />
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
              <Link to="/pedidos" search={pedidosListSearch} className="btn btn-ghost btn-xs gap-1">
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
                    <th className="text-right">{moneyHeading("Total", "USD")}</th>
                    <th className="text-right">{moneyHeading("Total", "CUP")}</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((inv) => {
                    const rowRate =
                      inv.exchangeRateSnapshot && inv.exchangeRateSnapshot > 0
                        ? inv.exchangeRateSnapshot
                        : rate;
                    const paidInCup = (inv.paymentCurrency ?? "").toUpperCase() === "CUP";
                    return (
                      <tr key={inv.id}>
                        <td className="font-mono text-xs">{inv.invoiceNumber}</td>
                        <td className="max-w-[12rem] truncate">{inv.clientName}</td>
                        <td className="text-xs">{formatDate(inv.date)}</td>
                        <td className="text-right tabular-nums">
                          {formatAmount(cupToUsd(inv.total, rowRate))}
                        </td>
                        <td className="text-right tabular-nums">
                          {paidInCup ? formatAmount(inv.total) : "—"}
                        </td>
                        <td>
                          <span
                            className={`badge badge-sm ${inv.paymentStatus === "cobrado" ? "badge-success" : "badge-warning"}`}
                          >
                            {inv.paymentStatus === "cobrado" ? "Cobrado" : "Pendiente"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {recentInvoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-base-content/60">
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

        <div className="card bg-base-200 lg:col-span-3">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <h3 className="card-title text-base">
                <DatabaseBackup className="h-5 w-5" /> Últimos backups
              </h3>
              <Link
                to="/configuracion"
                search={{ tab: "backup" }}
                className="btn btn-ghost btn-xs gap-1"
              >
                Configurar <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <p className="text-xs text-base-content/60">
              Backup automático cada {backupOverviewQuery.data?.intervalDays ?? 1} día(s). Último
              programado: {backupOverviewQuery.data?.lastScheduledBackupAt ?? "Sin registro"}
            </p>
            {backupOverviewQuery.isLoading ? (
              <p className="text-sm text-base-content/60">Cargando backups...</p>
            ) : backups.length === 0 ? (
              <p className="text-sm text-base-content/60">Todavía no hay backups registrados.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                {backups.map((backup) => (
                  <div key={backup.path} className="rounded-lg border border-base-300 p-3">
                    <p className="truncate font-mono text-xs" title={backup.path}>
                      {backup.fileName}
                    </p>
                    <p className="mt-1 text-xs text-base-content/60">
                      {backup.kind} · {formatDateTime(backup.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
