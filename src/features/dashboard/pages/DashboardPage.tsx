import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  ArrowLeftRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  DatabaseBackup,
  History,
  Package,
  PackageSearch,
  Receipt,
  Tag,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { fetchCashBalance, fetchCashControlSummary, fetchCashNetSummary, fetchCashTransactions } from "@/db/queries/cashflow";
import { fetchCategories } from "@/db/queries/categories";
import { formatCashNet } from "@/features/cashflow/lib/cash-amount-display";
import { fetchClients } from "@/db/queries/clients";
import { fetchEmployees, fetchPayrollDaily, fetchPayrollInRange } from "@/db/queries/employees";
import { fetchInventoryItems, fetchInventoryMovementsList, fetchInventoryConsumptionSummary } from "@/db/queries/inventory";
import { formatConsumptionQty } from "@/features/inventory/lib/consumption-summary";
import { fetchInvoiceMetrics, fetchInvoices } from "@/db/queries/invoices";
import { fetchOtherExpenses, fetchOtherExpensesSummary } from "@/db/queries/other-expenses";
import { fetchPrices } from "@/db/queries/prices";
import { fetchReportsSummary } from "@/db/queries/reports";
import { fetchBackupOverview } from "@/db/queries/settings";
import { useAppSettings } from "@/hooks/use-app-settings";
import { cupToUsd } from "@/lib/currency";
import { DualPhysicalAmounts } from "@/components/common/DualPhysicalAmounts";
import { currentMonthYm, formatDate, formatDateTime, monthEndIso, monthStartIso, todayIso } from "@/lib/format-date";
import { formatAmount, moneyHeading } from "@/lib/format-money";
import { facturasListSearch } from "@/lib/facturas-search";
import { pedidosListSearch } from "@/lib/pedidos-search";
import { preciosListSearch } from "@/lib/precios-search";

/**
 * Tarjeta KPI del dashboard (contenido interno; el enlace lo pone el padre).
 *
 * @param props - Etiqueta, valor, pie opcional, icono y estilo.
 * @returns Cuerpo del indicador.
 */
function KpiCard(props: {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  icon: LucideIcon;
  accent: string;
}) {
  const { label, value, caption, icon: Icon, accent } = props;
  return (
    <div className="card-body h-full flex-row items-center gap-3 px-3 py-2.5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${accent}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="truncate text-[11px] uppercase leading-tight tracking-wide text-base-content/60">
          {label}
        </p>
        <div className="flex min-h-[1.75rem] w-full min-w-0 items-center text-lg font-semibold leading-none">
          {value}
        </div>
        <p className="mt-0.5 truncate text-[11px] font-normal leading-tight text-base-content/60">
          {caption ?? "\u00a0"}
        </p>
      </div>
    </div>
  );
}

/** Clases compartidas de los paneles KPI clicables del Inicio. */
const KPI_LINK_CLASS =
  "card flex h-full min-h-[5.75rem] bg-base-200 transition hover:bg-base-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";


/**
 * Pantalla de Inicio: KPIs clicables, pedidos recientes y alertas.
 *
 * @returns Página de inicio.
 */
export function DashboardPage() {
  const settings = useAppSettings();
  const rate = settings.usdExchangeRate;

  const today = todayIso();
  const monthStart = monthStartIso(today);
  const monthEnd = monthEndIso(today);

  const summaryQuery = useQuery({
    queryKey: ["reports", "summary", monthStart, monthEnd],
    queryFn: () => fetchReportsSummary({ dateFrom: monthStart, dateTo: monthEnd }),
  });

  const metricsQuery = useQuery({
    queryKey: ["invoices", "metrics"],
    queryFn: fetchInvoiceMetrics,
  });

  const invoicesQuery = useQuery({
    queryKey: ["invoices", "list"],
    queryFn: fetchInvoices,
  });

  const clientsQuery = useQuery({
    queryKey: ["clients", "list"],
    queryFn: fetchClients,
  });

  const employeesQuery = useQuery({
    queryKey: ["employees", "list"],
    queryFn: () => fetchEmployees(false),
  });

  const payrollTodayQuery = useQuery({
    queryKey: ["payroll-daily", today],
    queryFn: () => fetchPayrollDaily(today),
  });

  const payrollMonthQuery = useQuery({
    queryKey: ["employees", "payroll-range", monthStart, monthEnd],
    queryFn: () => fetchPayrollInRange({ dateFrom: monthStart, dateTo: monthEnd }),
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory", "list"],
    queryFn: fetchInventoryItems,
  });

  const inventoryMovementsQuery = useQuery({
    queryKey: ["inventory", "movements", "list", "mes"],
    queryFn: () => fetchInventoryMovementsList("mes"),
  });

  const consumptionQuery = useQuery({
    queryKey: ["inventory", "consumption-summary", "mes"],
    queryFn: () => fetchInventoryConsumptionSummary("mes"),
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories", "active"],
    queryFn: () => fetchCategories(true),
  });

  const pricesQuery = useQuery({
    queryKey: ["prices", "list", false],
    queryFn: () => fetchPrices(false),
  });

  const cashBalanceQuery = useQuery({
    queryKey: ["cashflow", "balance"],
    queryFn: fetchCashBalance,
  });

  const cashNetQuery = useQuery({
    queryKey: ["cashflow", "net-summary"],
    queryFn: fetchCashNetSummary,
  });

  const cashControlQuery = useQuery({
    queryKey: ["cashflow", "control", currentMonthYm(), today],
    queryFn: () => fetchCashControlSummary(currentMonthYm(), today),
  });

  const cashHistoryQuery = useQuery({
    queryKey: ["cashflow", "history", monthStart, monthEnd],
    queryFn: () => fetchCashTransactions({ dateFrom: monthStart, dateTo: monthEnd }),
  });

  const otherExpensesQuery = useQuery({
    queryKey: ["other-expenses", "list"],
    queryFn: fetchOtherExpenses,
  });

  const otherExpensesSummaryQuery = useQuery({
    queryKey: ["other-expenses", "summary"],
    queryFn: fetchOtherExpensesSummary,
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
  const processedThisMonthCount = invoices.filter((inv) => {
    if (inv.status === "anulada") {
      return false;
    }
    if (inv.date < monthStart || inv.date > monthEnd) {
      return false;
    }
    return inv.productionStatus === "listo";
  }).length;
  const inProductionCount = invoices.filter(
    (inv) => inv.status !== "anulada" && inv.productionStatus === "en_produccion",
  ).length;
  const registeredClientsCount = clientsQuery.data?.length ?? 0;
  const activeEmployeesCount = (employeesQuery.data ?? []).filter((emp) => emp.isActive).length;
  const payrollTodayRows = payrollTodayQuery.data ?? [];
  const payrollTodayTotals = payrollTodayRows.reduce(
    (acc, row) => ({
      pending: acc.pending + row.pending,
      paid: acc.paid + row.paid,
      workers: acc.workers + 1,
    }),
    { pending: 0, paid: 0, workers: 0 },
  );
  const payrollMonthPaid = (payrollMonthQuery.data ?? []).reduce(
    (sum, row) => sum + row.paid,
    0,
  );
  const payrollMonthWorkers = payrollMonthQuery.data?.length ?? 0;
  const inventoryItems = inventoryQuery.data ?? [];
  const materialesCount = inventoryItems.length;
  const materialesLowStockCount = inventoryItems.filter((item) => item.lowStock).length;
  const materialesDeficitCount = inventoryItems.filter((item) => item.deficit).length;
  const movimientosMes = inventoryMovementsQuery.data ?? [];
  const movimientosMesCount = movimientosMes.length;
  const movimientosEntradasCount = movimientosMes.filter((mov) => mov.movementType === "entrada").length;
  const movimientosSalidasCount = movimientosMesCount - movimientosEntradasCount;
  const consumoMes = consumptionQuery.data ?? [];
  const consumoSalidas = consumoMes.reduce((sum, row) => sum + row.salidas, 0);
  const consumoMermas = consumoMes.reduce((sum, row) => sum + row.mermas, 0);
  const consumoVentas = consumoMes.reduce((sum, row) => sum + row.ventas, 0);
  const categoriasPreciosCount = categoriesQuery.data?.length ?? 0;
  const preciosDefinidosCount = pricesQuery.data?.length ?? 0;
  const cashBalance = cashBalanceQuery.data;
  const cashNet = cashNetQuery.data;
  const cashNetTodayUsd = formatCashNet(cashNet?.netTodayUsd ?? 0);
  const cashNetTodayCup = formatCashNet(cashNet?.netTodayCup ?? 0);
  const cashNetTodayNegative =
    (cashNet?.netTodayUsd ?? 0) < -1e-3 || (cashNet?.netTodayCup ?? 0) < -1e-3;
  const cashControlCup = cashControlQuery.data?.cup;
  const cashControlUsd = cashControlQuery.data?.usd;
  const cashControlHasOpening = Boolean(cashControlCup?.hasOpening);
  const cashHistoryMonth = cashHistoryQuery.data ?? [];
  const cashHistoryCount = cashHistoryMonth.length;
  const cashHistoryIngresos = cashHistoryMonth.filter((tx) => tx.transactionType === "ingreso").length;
  const cashHistoryEgresos = cashHistoryCount - cashHistoryIngresos;
  const otherExpensesMonthCount = (otherExpensesQuery.data ?? []).filter(
    (gasto) => gasto.date >= monthStart && gasto.date <= monthEnd,
  ).length;
  const otherExpensesMonthCup = otherExpensesSummaryQuery.data?.monthCup ?? 0;
  const otherExpensesMonthUsd = otherExpensesSummaryQuery.data?.monthUsd ?? 0;

  const backups = backupOverviewQuery.data?.backups ?? [];

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Bienvenido — {settings.businessName}</h2>
        <p className="text-sm text-base-content/60">Resumen del mes en curso</p>
      </div>

      <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/facturas" search={facturasListSearch} title="Ir a Facturas" className={KPI_LINK_CLASS}>
          <KpiCard
            label="Facturación del mes"
            value={
              <DualPhysicalAmounts
                compact
                amountCup={summary?.totalBilledCup ?? 0}
                amountUsd={summary?.totalBilledUsd ?? 0}
              />
            }
            caption="Mes en curso"
            icon={Receipt}
            accent="bg-primary/15 text-primary"
          />
        </Link>
        <Link
          to="/facturas"
          search={{ estado: "pendiente" }}
          title="Ir a Facturas pendientes"
          className={KPI_LINK_CLASS}
        >
          <KpiCard
            label="Facturación Pendiente"
            value={
              <DualPhysicalAmounts
                compact
                amountCup={metricsQuery.data?.pendientesAmountCup ?? 0}
                amountUsd={metricsQuery.data?.pendientesAmountUsd ?? 0}
                valueClassName="text-error"
              />
            }
            caption={`${metricsQuery.data?.pendientesCount ?? 0} factura${
              (metricsQuery.data?.pendientesCount ?? 0) === 1 ? "" : "s"
            }`}
            icon={Receipt}
            accent="bg-error/15 text-error"
          />
        </Link>
        <Link to="/pedidos" search={pedidosListSearch} title="Ir a Pedidos" className={KPI_LINK_CLASS}>
          <KpiCard
            label="Pedidos procesados"
            value={processedThisMonthCount}
            caption={`${processedThisMonthCount === 1 ? "pedido listo" : "pedidos listos"} este mes`}
            icon={CheckCircle2}
            accent="bg-success/15 text-success"
          />
        </Link>
        <Link
          to="/pedidos"
          search={{ filter: "en_produccion" }}
          title="Ir a Pedidos en producción"
          className={KPI_LINK_CLASS}
        >
          <KpiCard
            label="Pedidos en Producción"
            value={inProductionCount}
            caption={inProductionCount === 1 ? "pedido activo" : "pedidos activos"}
            icon={ClipboardList}
            accent="bg-warning/15 text-warning"
          />
        </Link>
        <Link to="/pedidos" search={pedidosListSearch} title="Ir a Pedidos" className={KPI_LINK_CLASS}>
          <KpiCard
            label="Clientes registrados"
            value={registeredClientsCount}
            caption={`${registeredClientsCount === 1 ? "cliente" : "clientes"} · ${
              summary?.clientsWithReceivablesCount ?? 0
            } con deuda`}
            icon={Users}
            accent="bg-info/15 text-info"
          />
        </Link>
        <Link to="/empleados" title="Ir a Empleados" className={KPI_LINK_CLASS}>
          <KpiCard
            label="Empleados activos"
            value={activeEmployeesCount}
            caption={activeEmployeesCount === 1 ? "trabajador activo" : "trabajadores activos"}
            icon={UserCog}
            accent="bg-primary/15 text-primary"
          />
        </Link>
        <Link to="/empleados/nomina-diaria" title="Ir a Nómina diaria" className={KPI_LINK_CLASS}>
          <KpiCard
            label="Nómina diaria"
            value={<span className="text-warning">{formatAmount(payrollTodayTotals.pending)}</span>}
            caption={`${moneyHeading("Pendiente", "CUP")} · ${payrollTodayTotals.workers} trabajador${
              payrollTodayTotals.workers === 1 ? "" : "es"
            } hoy`}
            icon={CalendarDays}
            accent="bg-warning/15 text-warning"
          />
        </Link>
        <Link
          to="/empleados/historial-nomina"
          title="Ir a Historial de nómina"
          className={KPI_LINK_CLASS}
        >
          <KpiCard
            label="Historial de Nómina"
            value={<span className="text-success">{formatAmount(payrollMonthPaid)}</span>}
            caption={`${moneyHeading("Pagado", "CUP")} este mes · ${payrollMonthWorkers} trabajador${
              payrollMonthWorkers === 1 ? "" : "es"
            }`}
            icon={Banknote}
            accent="bg-success/15 text-success"
          />
        </Link>
        <Link to="/inventario" title="Ir a Inventario" className={KPI_LINK_CLASS}>
          <KpiCard
            label="Materiales de inventario"
            value={materialesCount}
            caption={
              materialesDeficitCount > 0
                ? `${materialesCount === 1 ? "material" : "materiales"} · ${materialesLowStockCount} stock bajo · ${materialesDeficitCount} déficit`
                : `${materialesCount === 1 ? "material" : "materiales"} · ${materialesLowStockCount} stock bajo`
            }
            icon={Package}
            accent={
              materialesDeficitCount > 0 || materialesLowStockCount > 0
                ? "bg-warning/15 text-warning"
                : "bg-info/15 text-info"
            }
          />
        </Link>
        <Link to="/inventario/movimientos" title="Ir a Movimientos de inventario" className={KPI_LINK_CLASS}>
          <KpiCard
            label="Movimientos de inventario"
            value={movimientosMesCount}
            caption={`${movimientosMesCount === 1 ? "movimiento" : "movimientos"} este mes · ${movimientosEntradasCount} entrada${
              movimientosEntradasCount === 1 ? "" : "s"
            } · ${movimientosSalidasCount} salida${movimientosSalidasCount === 1 ? "" : "s"}`}
            icon={ArrowLeftRight}
            accent="bg-secondary/15 text-secondary"
          />
        </Link>
        <Link to="/inventario/resumen" title="Ir a Resumen de consumo" className={KPI_LINK_CLASS}>
          <KpiCard
            label="Consumo de materiales"
            value={formatConsumptionQty(consumoSalidas)}
            caption={`salidas este mes · ${formatConsumptionQty(consumoMermas)} mermas · ${formatConsumptionQty(consumoVentas)} ventas`}
            icon={PackageSearch}
            accent="bg-accent/15 text-accent"
          />
        </Link>
        <Link to="/precios" search={preciosListSearch} title="Ir a Precios" className={KPI_LINK_CLASS}>
          <KpiCard
            label="Precios de productos"
            value={categoriasPreciosCount}
            caption={`${categoriasPreciosCount === 1 ? "categoría" : "categorías"} · ${preciosDefinidosCount} precio${
              preciosDefinidosCount === 1 ? "" : "s"
            }`}
            icon={Tag}
            accent="bg-primary/15 text-primary"
          />
        </Link>
        <Link to="/caja" title="Ir a Flujo de Caja" className={KPI_LINK_CLASS}>
          <KpiCard
            label="Flujo de Caja"
            value={
              <DualPhysicalAmounts
                compact
                amountCup={cashBalance?.balanceCup ?? 0}
                amountUsd={cashBalance?.balanceUsd ?? 0}
              />
            }
            caption={`neto hoy ${cashNetTodayUsd.text} USD · ${cashNetTodayCup.text} CUP`}
            icon={Wallet}
            accent={
              cashNetTodayNegative ? "bg-error/15 text-error" : "bg-success/15 text-success"
            }
          />
        </Link>
        <Link to="/caja/control" title="Ir a Control de efectivo" className={KPI_LINK_CLASS}>
          <KpiCard
            label="Control de efectivo"
            value={
              <DualPhysicalAmounts
                compact
                amountCup={cashControlCup?.estimatedTotal ?? 0}
                amountUsd={cashControlUsd?.estimatedTotal ?? 0}
              />
            }
            caption={
              cashControlHasOpening
                ? "estimado del mes · saldo inicial registrado"
                : "estimado del mes · sin saldo inicial"
            }
            icon={Banknote}
            accent={
              cashControlHasOpening ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
            }
          />
        </Link>
        <Link to="/caja/historial" title="Ir a Historial de caja" className={KPI_LINK_CLASS}>
          <KpiCard
            label="Historial de caja"
            value={cashHistoryCount}
            caption={`${cashHistoryCount === 1 ? "movimiento" : "movimientos"} este mes · ${cashHistoryIngresos} ingreso${
              cashHistoryIngresos === 1 ? "" : "s"
            } · ${cashHistoryEgresos} egreso${cashHistoryEgresos === 1 ? "" : "s"}`}
            icon={History}
            accent="bg-info/15 text-info"
          />
        </Link>
        <Link to="/otros-gastos" title="Ir a Otros gastos" className={KPI_LINK_CLASS}>
          <KpiCard
            label="Otros gastos"
            value={
              <DualPhysicalAmounts
                compact
                amountCup={otherExpensesMonthCup}
                amountUsd={otherExpensesMonthUsd}
                valueClassName="text-error"
              />
            }
            caption={`${otherExpensesMonthCount === 1 ? "gasto" : "gastos"} este mes`}
            icon={Receipt}
            accent="bg-error/15 text-error"
          />
        </Link>
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
