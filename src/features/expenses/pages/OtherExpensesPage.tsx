import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FileSpreadsheet, FileText, Plus, Receipt, Settings2, Trash2 } from "lucide-react";
import {
  deleteOtherExpense,
  fetchOtherExpenses,
  fetchOtherExpensesSummary,
} from "@/db/queries/other-expenses";
import { ExpenseTypesConfigModal } from "@/features/expenses/components/ExpenseTypesConfigModal";
import { reportExportBasename } from "@/features/reports/lib/report-period";
import { formatDate, todayIso } from "@/lib/format-date";
import { formatAmount, moneyHeading } from "@/lib/format-money";
import { popFlashMessage, type FlashMessage } from "@/lib/flash-message";
import {
  downloadReportsXlsx,
  openReportsPrintablePdf,
  type ReportTableSection,
} from "@/lib/report-export";
import type { OtherExpenseDto } from "@/types/other-expense";

/** Periodo rápido del listado de Otros gastos. */
type ExpensePeriodFilter = "hoy" | "mes" | "todos";

const PERIOD_OPTIONS: { id: ExpensePeriodFilter; label: string }[] = [
  { id: "hoy", label: "Día actual" },
  { id: "mes", label: "Mes actual" },
  { id: "todos", label: "Todos" },
];

/**
 * Extrae `YYYY-MM-DD` de una fecha almacenada (con o sin hora).
 *
 * @param value - Fecha ISO del gasto.
 * @returns Solo la parte de fecha o cadena vacía.
 */
function expenseDateOnly(value: string): string {
  return value.trim().slice(0, 10);
}

/**
 * Filtra gastos según el periodo seleccionado (calendario local).
 *
 * @param expenses - Listado completo.
 * @param period - Periodo activo.
 * @returns Gastos del periodo.
 */
function filterExpensesByPeriod(
  expenses: OtherExpenseDto[],
  period: ExpensePeriodFilter,
): OtherExpenseDto[] {
  if (period === "todos") {
    return expenses;
  }
  const today = todayIso();
  if (period === "hoy") {
    return expenses.filter((e) => expenseDateOnly(e.date) === today);
  }
  const monthPrefix = today.slice(0, 7);
  return expenses.filter((e) => expenseDateOnly(e.date).startsWith(monthPrefix));
}

/**
 * Etiqueta del KPI de total según el periodo del listado.
 *
 * @param period - Periodo activo.
 * @returns Texto del KPI.
 */
function periodTotalLabel(period: ExpensePeriodFilter): string {
  switch (period) {
    case "hoy":
      return "Total del día (listado)";
    case "mes":
      return "Total del mes (listado)";
    default:
      return "Total listado";
  }
}

/**
 * Etiqueta del periodo para cabeceras y nombres de archivo.
 *
 * @param period - Periodo activo.
 * @returns Texto en español con fecha `dd/mm/aaaa` cuando aplica.
 */
function periodExportLabel(period: ExpensePeriodFilter): string {
  const today = todayIso();
  switch (period) {
    case "hoy":
      return `Día ${formatDate(today)}`;
    case "mes": {
      const parts = today.slice(0, 7).split("-");
      return parts.length === 2 ? `Mes ${parts[1]}/${parts[0]}` : "Mes actual";
    }
    default:
      return "Todos";
  }
}

/**
 * Secciones Excel/PDF del listado filtrado (CUP y USD).
 *
 * @param rows - Gastos del periodo.
 * @param periodLabel - Etiqueta del periodo.
 * @param totals - Totales físicos CUP/USD.
 * @returns Tablas para el exporte.
 */
function buildExpenseExportSections(
  rows: OtherExpenseDto[],
  periodLabel: string,
  totals: { cup: number; usd: number },
): ReportTableSection[] {
  return [
    {
      name: "METADATOS",
      aoa: [
        ["Campo", "Valor"],
        ["Periodo", periodLabel],
        ["Registros", rows.length],
        ["Total USD", totals.usd],
        ["Total CUP", totals.cup],
      ],
    },
    {
      name: "OTROS_GASTOS",
      aoa: [
        ["Fecha", "Concepto", "Tipo", "Empleado", "USD", "CUP", "Método"],
        ...rows.map((row) => [
          formatDate(row.date),
          row.concept,
          row.expenseType,
          row.employeeName ?? "",
          row.amountUsd,
          row.amountCup,
          row.paymentMethod,
        ]),
        ["TOTAL", "", "", "", totals.usd, totals.cup, ""],
      ],
    },
  ];
}

/**
 * Listado y resumen de Otros gastos. Alta en `/otros-gastos/nuevo`;
 * detalle/edición en rutas anidadas.
 *
 * @returns Página de otros gastos.
 */
export function OtherExpensesPage() {
  const queryClient = useQueryClient();
  const [showTypesModal, setShowTypesModal] = useState(false);
  const [period, setPeriod] = useState<ExpensePeriodFilter>("hoy");
  const [flash] = useState<FlashMessage | null>(() => popFlashMessage());
  const [exporting, setExporting] = useState(false);
  const [exportFlash, setExportFlash] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const expensesQuery = useQuery({
    queryKey: ["other-expenses", "list"],
    queryFn: fetchOtherExpenses,
  });
  const summaryQuery = useQuery({
    queryKey: ["other-expenses", "summary"],
    queryFn: fetchOtherExpensesSummary,
  });

  const expenses = expensesQuery.data ?? [];
  const summary = summaryQuery.data;

  const filteredExpenses = useMemo(
    () => filterExpensesByPeriod(expenses, period),
    [expenses, period],
  );
  const periodTotals = useMemo(() => {
    let cup = 0;
    let usd = 0;
    for (const e of filteredExpenses) {
      cup += e.amountCup;
      usd += e.amountUsd;
    }
    return { cup, usd };
  }, [filteredExpenses]);

  const deleteMutation = useMutation({
    mutationFn: deleteOtherExpense,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["other-expenses"] });
      void queryClient.invalidateQueries({ queryKey: ["cashflow"] });
    },
  });

  const periodLabel = periodExportLabel(period);
  const canExport = expensesQuery.isSuccess && !exporting;

  const handleExcel = async () => {
    if (!canExport) {
      return;
    }
    setExporting(true);
    setExportError(null);
    setExportFlash(null);
    try {
      const basename = reportExportBasename("Otros gastos", periodLabel);
      const path = await downloadReportsXlsx(
        basename,
        buildExpenseExportSections(filteredExpenses, periodLabel, periodTotals),
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
        `Otros gastos · ${periodLabel}`,
        buildExpenseExportSections(filteredExpenses, periodLabel, periodTotals),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExportError(message || "No se pudo abrir la impresión PDF.");
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Receipt className="h-6 w-6" /> Otros gastos
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm gap-1"
            onClick={() => setShowTypesModal(true)}
          >
            <Settings2 className="h-4 w-4" />
            Configurar tipos de gasto
          </button>
          <Link to="/otros-gastos/nuevo" className="btn btn-primary btn-sm gap-1">
            <Plus className="h-4 w-4" />
            Registrar gasto
          </Link>
        </div>
      </div>

      {flash && (
        <div className={flash.kind === "success" ? "alert alert-success" : "alert alert-info"}>
          <span>{flash.text}</span>
        </div>
      )}
      {exportFlash ? (
        <div className="alert alert-success">
          <span>{exportFlash}</span>
        </div>
      ) : null}
      {exportError ? (
        <div className="alert alert-error">
          <span>{exportError}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="card bg-base-200">
          <div className="card-body gap-2 p-4">
            <p className="text-xs uppercase text-base-content/60">Gasto de hoy</p>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-base-content/50">{moneyHeading("Gasto", "USD")}</p>
                <p className="text-xl font-semibold tabular-nums text-error">
                  {formatAmount(summary?.todayUsd ?? 0)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-base-content/50">{moneyHeading("Gasto", "CUP")}</p>
                <p className="text-xl font-semibold tabular-nums text-error">
                  {formatAmount(summary?.todayCup ?? 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="card bg-base-200">
          <div className="card-body gap-2 p-4">
            <p className="text-xs uppercase text-base-content/60">Gasto del mes</p>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-base-content/50">{moneyHeading("Gasto", "USD")}</p>
                <p className="text-xl font-semibold tabular-nums text-error">
                  {formatAmount(summary?.monthUsd ?? 0)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-base-content/50">{moneyHeading("Gasto", "CUP")}</p>
                <p className="text-xl font-semibold tabular-nums text-error">
                  {formatAmount(summary?.monthCup ?? 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="card bg-base-200">
          <div className="card-body gap-2 p-4">
            <p className="text-xs uppercase text-base-content/60">{periodTotalLabel(period)}</p>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-base-content/50">{moneyHeading("Total", "USD")}</p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatAmount(periodTotals.usd)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-base-content/50">{moneyHeading("Total", "CUP")}</p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatAmount(periodTotals.cup)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Periodo del listado</p>
          <p className="text-xs text-base-content/60">
            Filtra la tabla de forma rápida. Por defecto: día actual. Excel y PDF usan este mismo
            periodo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="join" role="group" aria-label="Filtrar gastos por periodo">
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

      {expensesQuery.isLoading && (
        <p className="text-sm text-base-content/60">Cargando gastos…</p>
      )}
      {expensesQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudieron cargar los gastos.</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Concepto</th>
              <th>Tipo</th>
              <th>Empleado</th>
              <th>Método</th>
              <th className="text-right">{moneyHeading("Importe", "USD")}</th>
              <th className="text-right">{moneyHeading("Importe", "CUP")}</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.map((exp) => (
              <tr key={exp.id}>
                <td className="text-xs">{formatDate(exp.date)}</td>
                <td>
                  <Link
                    to="/otros-gastos/$expenseId"
                    params={{ expenseId: String(exp.id) }}
                    className="link link-hover font-medium"
                  >
                    {exp.concept}
                  </Link>
                </td>
                <td>{exp.expenseType}</td>
                <td>{exp.employeeName ?? "—"}</td>
                <td className="capitalize">{exp.paymentMethod}</td>
                <td className="text-right tabular-nums">
                  {exp.amountUsd > 0.001 ? formatAmount(exp.amountUsd) : "—"}
                </td>
                <td className="text-right tabular-nums">
                  {exp.amountCup > 0.001 ? formatAmount(exp.amountCup) : "—"}
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    <Link
                      to="/otros-gastos/$expenseId"
                      params={{ expenseId: String(exp.id) }}
                      className="btn btn-xs btn-outline"
                    >
                      Ver
                    </Link>
                    <Link
                      to="/otros-gastos/$expenseId/editar"
                      params={{ expenseId: String(exp.id) }}
                      className="btn btn-xs btn-ghost"
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      title="Eliminar gasto"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm("¿Eliminar este gasto y su egreso en caja?")) {
                          deleteMutation.mutate(exp.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {expensesQuery.isSuccess && filteredExpenses.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-base-content/60">
                  {expenses.length === 0 ? (
                    <>
                      <p>Sin gastos registrados.</p>
                      <Link to="/otros-gastos/nuevo" className="btn btn-link btn-sm mt-2">
                        Registrar el primero
                      </Link>
                    </>
                  ) : (
                    <>
                      <p>No hay gastos en este periodo.</p>
                      <button
                        type="button"
                        className="btn btn-link btn-sm mt-2"
                        onClick={() => setPeriod("todos")}
                      >
                        Ver todos
                      </button>
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showTypesModal && (
        <ExpenseTypesConfigModal onClose={() => setShowTypesModal(false)} />
      )}
    </section>
  );
}
