import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useMemo, useState } from "react";
import { pushFlashMessage } from "@/lib/flash-message";
import { todayIso } from "@/lib/format-date";
import { fetchInvoices } from "@/db/queries/invoices";
import { fetchProductionExportInDateRange } from "@/db/queries/production";
import { fetchReportsSummary, fetchTopDebtors } from "@/db/queries/reports";
import { formatMoney } from "@/lib/format-money";
import {
  buildReportTables,
  buildReportsCsvFromTables,
  downloadReportsCsv,
  downloadReportsXlsx,
  openReportsPrintablePdf,
} from "@/lib/report-export";

const pct = new Intl.NumberFormat("es", { style: "percent", maximumFractionDigits: 1 });

export function ReportsPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const summaryQuery = useQuery({
    queryKey: ["reports", "summary", dateFrom, dateTo],
    queryFn: () =>
      fetchReportsSummary({
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      }),
  });

  const debtorsQuery = useQuery({
    queryKey: ["reports", "top-debtors"],
    queryFn: () => fetchTopDebtors(10),
  });

  const invoicesQuery = useQuery({
    queryKey: ["invoices", "list"],
    queryFn: fetchInvoices,
  });

  const rangeSelected = Boolean(dateFrom && dateTo);
  const productionRangeQuery = useQuery({
    queryKey: ["production", "export-range", dateFrom, dateTo],
    queryFn: () => fetchProductionExportInDateRange(dateFrom, dateTo),
    enabled: rangeSelected,
  });

  const canExport =
    summaryQuery.isSuccess &&
    debtorsQuery.isSuccess &&
    invoicesQuery.isSuccess &&
    (!rangeSelected || productionRangeQuery.isSuccess);

  const exportBasename = useMemo(() => {
    return `reportes-${todayIso()}`;
  }, []);

  const buildExportSections = () => {
    if (!summaryQuery.data || !debtorsQuery.data || !invoicesQuery.data) return null;
    const productionInRange =
      rangeSelected && productionRangeQuery.data ? productionRangeQuery.data : null;
    return buildReportTables(
      dateFrom,
      dateTo,
      summaryQuery.data,
      debtorsQuery.data,
      invoicesQuery.data,
      productionInRange,
    );
  };

  const handleExportCsv = async () => {
    try {
      const path = await invoke<string>("export_orders_csv", {
        args: { dateFrom: dateFrom || null, dateTo: dateTo || null },
      });
      pushFlashMessage({ kind: "success", text: `CSV guardado: ${path}` });
      return;
    } catch {
      /* fallback al exporte en navegador */
    }
    const sections = buildExportSections();
    if (!sections) return;
    downloadReportsCsv(`${exportBasename}.csv`, buildReportsCsvFromTables(sections));
  };

  const handleExportXlsx = async () => {
    try {
      const path = await invoke<string>("export_reports_xlsx", {
        args: { dateFrom: dateFrom || null, dateTo: dateTo || null },
      });
      pushFlashMessage({ kind: "success", text: `XLSX guardado: ${path}` });
      return;
    } catch {
      /* fallback */
    }
    const sections = buildExportSections();
    if (!sections) return;
    await downloadReportsXlsx(exportBasename, sections);
  };

  const handleExportPdf = async () => {
    try {
      const path = await invoke<string>("export_reports_pdf", {
        args: { dateFrom: dateFrom || null, dateTo: dateTo || null },
      });
      pushFlashMessage({ kind: "success", text: `PDF guardado: ${path}` });
      return;
    } catch {
      /* fallback */
    }
    const sections = buildExportSections();
    if (!sections) return;
    openReportsPrintablePdf(`Reportes FlexPyme · ${exportBasename}`, sections);
  };

  const s = summaryQuery.data;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-sm text-base-content/70">Métricas de ventas/cobros y cuentas por cobrar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline btn-sm" disabled={!canExport} onClick={() => handleExportCsv()}>
            CSV
          </button>
          <button type="button" className="btn btn-outline btn-sm" disabled={!canExport} onClick={() => handleExportXlsx()}>
            XLSX
          </button>
          <button type="button" className="btn btn-outline btn-sm" disabled={!canExport} onClick={() => handleExportPdf()}>
            PDF
          </button>
        </div>
      </div>

      <p className="text-xs text-base-content/60 max-w-3xl">
        <strong>PDF</strong> abre una vista para imprimir: en el cuadro de impresión elija &quot;Guardar como PDF&quot; o &quot;Microsoft Print to PDF&quot;.
      </p>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-base">Filtro de fechas (facturas y producción)</h2>
          <p className="text-xs text-base-content/60">
            El resumen usa este rango. Con &quot;desde&quot; y &quot;hasta&quot;, los exportes incluyen facturas en rango y datos de
            producción (lotes y líneas).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="form-control">
              <span className="label-text">Desde</span>
              <input type="date" className="input input-bordered" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label className="form-control">
              <span className="label-text">Hasta</span>
              <input type="date" className="input input-bordered" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
          </div>
          {rangeSelected && productionRangeQuery.isError && (
            <p className="text-error text-sm mt-2">No se pudo cargar la producción para el exporte. Revisa el rango e intenta de nuevo.</p>
          )}
          {rangeSelected && productionRangeQuery.isFetching && (
            <p className="text-base-content/60 text-sm mt-2">Cargando datos de producción para exportar...</p>
          )}
        </div>
      </div>

      {summaryQuery.isLoading && <p>Cargando resumen...</p>}
      {summaryQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudo cargar el resumen.</span>
        </div>
      )}
      {s && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Facturas</div>
              <div className="stat-value text-2xl">{s.invoicesCount}</div>
            </div>
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Total facturado</div>
              <div className="stat-value text-2xl">{formatMoney(s.totalBilled)}</div>
            </div>
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Total cobrado</div>
              <div className="stat-value text-2xl">{formatMoney(s.totalPaid)}</div>
            </div>
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Pendiente por cobrar</div>
              <div className="stat-value text-2xl">{formatMoney(s.totalPending)}</div>
            </div>
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Pagadas / parciales / pendientes</div>
              <div className="stat-value text-xl">
                {s.invoicesPaidCount} · {s.invoicesPartialCount} · {s.invoicesPendingCount}
              </div>
            </div>
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Promedio por factura</div>
              <div className="stat-value text-2xl">{formatMoney(s.averageInvoiceAmount)}</div>
            </div>
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Tasa de cobro</div>
              <div className="stat-value text-2xl">{pct.format(s.collectionRate)}</div>
            </div>
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Clientes con saldo</div>
              <div className="stat-value text-2xl">{s.clientsWithReceivablesCount}</div>
            </div>
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Costo producción</div>
              <div className="stat-value text-2xl">{formatMoney(s.productionTotalCost)}</div>
            </div>
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Pagado producción</div>
              <div className="stat-value text-2xl">{formatMoney(s.productionPaid)}</div>
            </div>
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Pendiente producción</div>
              <div className="stat-value text-2xl">{formatMoney(s.productionPending)}</div>
            </div>
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Lotes producción</div>
              <div className="stat-value text-2xl">{s.productionBatchesCount}</div>
            </div>
          </div>
        </>
      )}

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-base">Top clientes deudores</h2>
          {debtorsQuery.isLoading && <p className="text-sm">Cargando...</p>}
          {debtorsQuery.isError && <p className="text-error text-sm">No se pudo cargar la lista.</p>}
          {debtorsQuery.data && (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cliente</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {debtorsQuery.data.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center text-base-content/60">
                        No hay balances pendientes.
                      </td>
                    </tr>
                  ) : (
                    debtorsQuery.data.map((row) => (
                      <tr key={row.clientId}>
                        <td>{row.clientCode}</td>
                        <td>{row.clientName}</td>
                        <td className="text-right">{formatMoney(row.balance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
