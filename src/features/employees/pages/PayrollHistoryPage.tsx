import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Users,
  Wallet,
} from "lucide-react";
import { fetchEmployees, fetchPayrollHistory } from "@/db/queries/employees";
import {
  buildPayrollHistoryExportSections,
  filterPayrollHistoryRows,
  payrollHistoryPeriodLabel,
  payrollHistoryConceptLabel,
  payrollHistoryTotals,
  resolvePayrollHistoryRange,
  summarizePayrollByWorker,
  type PayrollHistoryConceptFilter,
  type PayrollHistoryPeriod,
  type PayrollHistoryStatusFilter,
} from "@/features/employees/lib/payroll-history";
import { reportExportBasename } from "@/features/reports/lib/report-period";
import {
  currentMonthYm,
  formatDate,
  monthStartIso,
  todayIso,
} from "@/lib/format-date";
import { formatAmount, moneyHeading } from "@/lib/format-money";
import {
  downloadReportsXlsx,
  openReportsPrintablePdf,
} from "@/lib/report-export";

const PERIOD_OPTIONS: { id: PayrollHistoryPeriod; label: string }[] = [
  { id: "hoy", label: "Día actual" },
  { id: "mes", label: "Mes" },
  { id: "rango", label: "Rango" },
  { id: "todos", label: "Todos" },
];

const STATUS_OPTIONS: { id: PayrollHistoryStatusFilter; label: string }[] = [
  { id: "", label: "Todos" },
  { id: "pagado", label: "Pagado" },
  { id: "pendiente", label: "Pendiente" },
];

const CONCEPT_OPTIONS: { id: PayrollHistoryConceptFilter; label: string }[] = [
  { id: "", label: "Todos" },
  { id: "lote", label: "Producción" },
  { id: "salario_fijo", label: "Salario fijo" },
  { id: "salario_destajo", label: "Destajo" },
  { id: "salario_mensual", label: "Mensual" },
];

/**
 * Historial de nómina: pagos por trabajador, detalle filtrable y exporte Excel/PDF.
 *
 * @returns Página de historial de nómina.
 */
export function PayrollHistoryPage() {
  const [period, setPeriod] = useState<PayrollHistoryPeriod>("mes");
  const [month, setMonth] = useState(() => currentMonthYm());
  const [rangeFrom, setRangeFrom] = useState(() => monthStartIso(todayIso()));
  const [rangeTo, setRangeTo] = useState(() => todayIso());
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState<PayrollHistoryStatusFilter>("");
  const [concept, setConcept] = useState<PayrollHistoryConceptFilter>("");
  const [exporting, setExporting] = useState(false);
  const [exportFlash, setExportFlash] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const { dateFrom, dateTo } = resolvePayrollHistoryRange(period, month, rangeFrom, rangeTo);
  const parsedEmployeeId = employeeId ? Number(employeeId) : null;

  const employeesQuery = useQuery({
    queryKey: ["employees", "list"],
    queryFn: () => fetchEmployees(false),
  });

  const historyQuery = useQuery({
    queryKey: ["employees", "payroll-history", dateFrom, dateTo, parsedEmployeeId],
    queryFn: () =>
      fetchPayrollHistory({
        dateFrom,
        dateTo,
        employeeId: parsedEmployeeId,
      }),
  });

  const visibleRows = useMemo(
    () => filterPayrollHistoryRows(historyQuery.data ?? [], status, concept),
    [historyQuery.data, status, concept],
  );
  const workers = useMemo(() => summarizePayrollByWorker(visibleRows), [visibleRows]);
  const totals = useMemo(
    () => payrollHistoryTotals(visibleRows, workers),
    [visibleRows, workers],
  );

  const periodLabel = payrollHistoryPeriodLabel(period, month, rangeFrom, rangeTo);
  const employeeLabel =
    employeesQuery.data?.find((e) => String(e.id) === employeeId)?.name ?? "Todos";
  const statusLabel = STATUS_OPTIONS.find((opt) => opt.id === status)?.label ?? "Todos";
  const conceptLabel = CONCEPT_OPTIONS.find((opt) => opt.id === concept)?.label ?? "Todos";
  const canExport = historyQuery.isSuccess && !exporting;

  const handleExcel = async () => {
    if (!canExport) {
      return;
    }
    setExporting(true);
    setExportError(null);
    setExportFlash(null);
    try {
      const basename = reportExportBasename("Historial de nómina", periodLabel);
      const path = await downloadReportsXlsx(
        basename,
        buildPayrollHistoryExportSections({
          rows: visibleRows,
          workers,
          periodLabel,
          employeeLabel,
          statusLabel,
          conceptLabel,
          totals,
        }),
      );
      if (path) {
        setExportFlash(`Excel guardado: ${path}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExportError(message || "No se pudo generar el Excel.");
    } finally {
      setExporting(false);
    }
  };

  const handlePdf = () => {
    if (!canExport) {
      return;
    }
    setExportError(null);
    setExportFlash(null);
    try {
      openReportsPrintablePdf(
        `Historial de nómina · ${periodLabel}`,
        buildPayrollHistoryExportSections({
          rows: visibleRows,
          workers,
          periodLabel,
          employeeLabel,
          statusLabel,
          conceptLabel,
          totals,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExportError(message || "No se pudo abrir la impresión PDF.");
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <Link to="/empleados" className="btn btn-ghost btn-sm gap-2 px-0">
            <ArrowLeft className="h-4 w-4" />
            Empleados
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ClipboardList className="h-6 w-6" /> Historial de nómina
          </h1>
          <p className="max-w-2xl text-sm text-base-content/70">
            Pagos y pendientes en CUP. Incluye lotes de producción y salarios fijos, destajo o
            mensuales. Excel y PDF usan los filtros activos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm gap-1"
            disabled={!canExport}
            onClick={() => void handleExcel()}
          >
            <FileSpreadsheet className="h-4 w-4" /> {exporting ? "Guardando…" : "Excel"}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm gap-1"
            disabled={!canExport}
            onClick={handlePdf}
          >
            <FileText className="h-4 w-4" /> PDF
          </button>
        </div>
      </div>

      {exportFlash ? (
        <div className="alert alert-success py-2 text-sm">
          <span>{exportFlash}</span>
        </div>
      ) : null}
      {exportError ? (
        <div className="alert alert-error py-2 text-sm">
          <span>{exportError}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
        <div className="form-control">
          <span className="label-text mb-1">Periodo</span>
          <div className="join" role="group" aria-label="Periodo del historial">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`btn btn-sm join-item ${period === opt.id ? "btn-primary" : "btn-ghost"}`}
                aria-pressed={period === opt.id}
                onClick={() => setPeriod(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {period === "mes" ? (
          <div className="form-control">
            <label className="label py-1" htmlFor="nomina-mes">
              <span className="label-text">Mes</span>
            </label>
            <input
              id="nomina-mes"
              type="month"
              className="input input-bordered input-sm"
              value={month}
              onChange={(e) => setMonth(e.target.value || currentMonthYm())}
            />
          </div>
        ) : null}
        {period === "rango" ? (
          <>
            <div className="form-control">
              <label className="label py-1" htmlFor="nomina-desde">
                <span className="label-text">Desde</span>
              </label>
              <input
                id="nomina-desde"
                type="date"
                className="input input-bordered input-sm"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label py-1" htmlFor="nomina-hasta">
                <span className="label-text">Hasta</span>
              </label>
              <input
                id="nomina-hasta"
                type="date"
                className="input input-bordered input-sm"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
              />
            </div>
          </>
        ) : null}
        <div className="form-control min-w-[10rem]">
          <label className="label py-1" htmlFor="nomina-trabajador">
            <span className="label-text">Trabajador</span>
          </label>
          <select
            id="nomina-trabajador"
            className="select select-bordered select-sm"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">Todos</option>
            {(employeesQuery.data ?? []).map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
                {emp.isActive ? "" : " (baja)"}
              </option>
            ))}
          </select>
        </div>
        <div className="form-control">
          <label className="label py-1" htmlFor="nomina-estado">
            <span className="label-text">Estado</span>
          </label>
          <select
            id="nomina-estado"
            className="select select-bordered select-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as PayrollHistoryStatusFilter)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.id || "todos"} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-control">
          <label className="label py-1" htmlFor="nomina-concepto">
            <span className="label-text">Concepto</span>
          </label>
          <select
            id="nomina-concepto"
            className="select select-bordered select-sm"
            value={concept}
            onChange={(e) => setConcept(e.target.value as PayrollHistoryConceptFilter)}
          >
            {CONCEPT_OPTIONS.map((opt) => (
              <option key={opt.id || "todos"} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-xl border border-base-300 bg-base-100 px-3 py-3">
          <p className="text-[10px] uppercase tracking-wide text-base-content/60">
            {moneyHeading("Total", "CUP")}
          </p>
          <p className="text-xl font-semibold tabular-nums">{formatAmount(totals.totalCost)}</p>
        </div>
        <div className="rounded-xl border border-base-300 bg-base-100 px-3 py-3">
          <p className="text-[10px] uppercase tracking-wide text-base-content/60">
            {moneyHeading("Pagado", "CUP")}
          </p>
          <p className="text-xl font-semibold tabular-nums text-success">{formatAmount(totals.paid)}</p>
        </div>
        <div className="rounded-xl border border-base-300 bg-base-100 px-3 py-3">
          <p className="text-[10px] uppercase tracking-wide text-base-content/60">
            {moneyHeading("Pendiente", "CUP")}
          </p>
          <p className="text-xl font-semibold tabular-nums text-warning">
            {formatAmount(totals.pending)}
          </p>
        </div>
        <div className="rounded-xl border border-base-300 bg-base-100 px-3 py-3">
          <p className="text-[10px] uppercase tracking-wide text-base-content/60">Trabajadores</p>
          <p className="text-xl font-semibold tabular-nums">{totals.workers}</p>
        </div>
      </div>

      {historyQuery.isLoading ? (
        <p className="text-sm text-base-content/60">Cargando historial de nómina…</p>
      ) : null}
      {historyQuery.isError ? (
        <div className="alert alert-error">
          <span>
            {historyQuery.error instanceof Error
              ? historyQuery.error.message
              : "No se pudo cargar el historial de nómina."}
          </span>
        </div>
      ) : null}

      <article className="rounded-xl border border-base-300 bg-base-100 shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-base-200 px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Users className="h-4 w-4" /> Pagos por trabajador
          </h2>
          <p className="text-xs text-base-content/60">{periodLabel}</p>
        </header>
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Trabajador</th>
                <th className="text-right">Movimientos</th>
                <th className="text-right">{moneyHeading("Total", "CUP")}</th>
                <th className="text-right">{moneyHeading("Pagado", "CUP")}</th>
                <th className="text-right">{moneyHeading("Pendiente", "CUP")}</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.employeeId}>
                  <td>
                    <Link
                      to="/empleados/$employeeId"
                      params={{ employeeId: String(w.employeeId) }}
                      className="link link-hover font-medium"
                    >
                      {w.employeeName}
                    </Link>
                  </td>
                  <td className="text-right tabular-nums">{w.movimientos}</td>
                  <td className="text-right tabular-nums">{formatAmount(w.totalCost)}</td>
                  <td className="text-right tabular-nums text-success">{formatAmount(w.paid)}</td>
                  <td className="text-right tabular-nums text-warning">{formatAmount(w.pending)}</td>
                </tr>
              ))}
              {workers.length === 0 && !historyQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-base-content/60">
                    No hay pagos de trabajadores en este filtro.
                  </td>
                </tr>
              ) : null}
            </tbody>
            {workers.length > 0 ? (
              <tfoot>
                <tr className="bg-base-200/80 font-semibold">
                  <td>Total</td>
                  <td className="text-right tabular-nums">{visibleRows.length}</td>
                  <td className="text-right tabular-nums">{formatAmount(totals.totalCost)}</td>
                  <td className="text-right tabular-nums text-success">{formatAmount(totals.paid)}</td>
                  <td className="text-right tabular-nums text-warning">
                    {formatAmount(totals.pending)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </article>

      <article className="rounded-xl border border-base-300 bg-base-100 shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-base-200 px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Wallet className="h-4 w-4" /> Historial de pagos
          </h2>
          <p className="text-xs text-base-content/60">
            {visibleRows.length === 1 ? "1 movimiento" : `${visibleRows.length} movimientos`}
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="table table-zebra table-sm">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Trabajador</th>
                <th>Concepto</th>
                <th>Origen</th>
                <th className="text-right">{moneyHeading("Total", "CUP")}</th>
                <th className="text-right">{moneyHeading("Pagado", "CUP")}</th>
                <th className="text-right">{moneyHeading("Pendiente", "CUP")}</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={`${row.source}-${row.id}`}>
                  <td className="whitespace-nowrap text-xs">{formatDate(row.date)}</td>
                  <td>
                    <Link
                      to="/empleados/$employeeId"
                      params={{ employeeId: String(row.employeeId) }}
                      className="link link-hover"
                    >
                      {row.employeeName}
                    </Link>
                  </td>
                  <td>{payrollHistoryConceptLabel(row)}</td>
                  <td>
                    <span
                      className={`badge badge-sm ${
                        row.source === "lote" ? "badge-info" : "badge-ghost"
                      }`}
                    >
                      {row.source === "lote" ? "Lote" : "Salario"}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{formatAmount(row.totalCost)}</td>
                  <td className="text-right tabular-nums text-success">{formatAmount(row.paid)}</td>
                  <td className="text-right tabular-nums text-warning">{formatAmount(row.pending)}</td>
                  <td>
                    <span
                      className={`badge badge-sm ${
                        row.status === "pagado" ? "badge-success" : "badge-warning"
                      }`}
                    >
                      {row.status === "pagado" ? "Pagado" : "Pendiente"}
                    </span>
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && !historyQuery.isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-base-content/60">
                    No hay movimientos de nómina en este filtro.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
