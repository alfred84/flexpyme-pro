import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
import { fetchIncomeByCategory, fetchReportsSummary } from "@/db/queries/reports";
import { fetchInvoices } from "@/db/queries/invoices";
import { fetchBackupOverview } from "@/db/queries/settings";
import { useAppSettings } from "@/hooks/use-app-settings";
import { cupToUsd } from "@/lib/currency";
import { formatDate, formatDateTime, todayIso } from "@/lib/format-date";
import { formatAmount, moneyHeading } from "@/lib/format-money";
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
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs uppercase tracking-wide text-base-content/60">{label}</p>
          <div className="text-xl font-semibold leading-tight">{value}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Importes físicos CUP y USD (sin conversión), mismo patrón que Caja y Facturas.
 *
 * @param props - Montos por moneda y clase opcional del valor.
 * @returns Bloque dual CUP | USD.
 */
function DualPhysicalAmounts(props: {
  amountCup: number;
  amountUsd: number;
  valueClassName?: string;
}) {
  const { amountCup, amountUsd, valueClassName = "" } = props;
  return (
    <div className="mt-0.5 grid grid-cols-2 gap-3">
      <div>
        <p className="text-[10px] font-normal uppercase tracking-wide text-base-content/50">
          {moneyHeading("Importe", "CUP")}
        </p>
        <p className={`text-lg tabular-nums ${valueClassName}`}>{formatAmount(amountCup)}</p>
      </div>
      <div>
        <p className="text-[10px] font-normal uppercase tracking-wide text-base-content/50">
          {moneyHeading("Importe", "USD")}
        </p>
        <p className={`text-lg tabular-nums ${valueClassName}`}>{formatAmount(amountUsd)}</p>
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

  const now = new Date();
  const monthStart = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const today = todayIso();

  const summaryQuery = useQuery({
    queryKey: ["reports", "summary", monthStart, monthEnd],
    queryFn: () => fetchReportsSummary({ dateFrom: monthStart, dateTo: monthEnd }),
  });

  const incomeQuery = useQuery({
    queryKey: ["reports", "income-by-category", monthStart, monthEnd],
    queryFn: () => fetchIncomeByCategory({ dateFrom: monthStart, dateTo: monthEnd }),
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
        totalCup: row.totalCup,
        totalUsd: row.totalUsd,
      })),
    [incomeQuery.data],
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
          label="Facturación del mes"
          value={
            <DualPhysicalAmounts
              amountCup={summary?.totalBilledCup ?? 0}
              amountUsd={summary?.totalBilledUsd ?? 0}
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
          label="Cobros pendientes"
          value={
            <DualPhysicalAmounts
              amountCup={summary?.totalPendingCup ?? 0}
              amountUsd={summary?.totalPendingUsd ?? 0}
              valueClassName="text-error"
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
          <h3 className="card-title text-base">Ingresos por categoría (mes actual)</h3>
          {incomeQuery.isLoading ? (
            <div className="h-72 animate-pulse rounded-lg bg-base-300" />
          ) : chartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-base-content/60">Sin datos en el período.</p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    yAxisId="cup"
                    tick={{ fontSize: 11 }}
                    width={72}
                    tickFormatter={(value: number) => formatAmount(Number(value))}
                    label={{ value: "CUP", angle: -90, position: "insideLeft", fontSize: 10 }}
                  />
                  <YAxis
                    yAxisId="usd"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    width={56}
                    tickFormatter={(value: number) => formatAmount(Number(value))}
                    label={{ value: "USD", angle: 90, position: "insideRight", fontSize: 10 }}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      formatAmount(Number(value)),
                      name === "totalCup" ? "CUP" : "USD",
                    ]}
                  />
                  <Legend formatter={(value) => (value === "totalCup" ? "CUP" : "USD")} />
                  <Bar
                    yAxisId="cup"
                    dataKey="totalCup"
                    name="totalCup"
                    fill="#0d9488"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="usd"
                    dataKey="totalUsd"
                    name="totalUsd"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
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
