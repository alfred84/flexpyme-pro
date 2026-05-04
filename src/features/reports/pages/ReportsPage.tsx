import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchInvoices } from "@/db/queries/invoices";
import { fetchProductionExportInDateRange } from "@/db/queries/production";
import { fetchReportsSummary, fetchTopDebtors } from "@/db/queries/reports";
import { buildCsvLine, downloadTextFile } from "@/lib/csv";
import type { InvoiceListDto } from "@/types/invoice";
import type { ProductionRangeExportDto } from "@/types/production";
import type { ReportsSummaryDto, TopDebtorDto } from "@/types/report";

const money = new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" });

function buildReportsCsv(
  dateFrom: string,
  dateTo: string,
  summary: ReportsSummaryDto,
  debtors: TopDebtorDto[],
  invoices: InvoiceListDto[],
  productionInRange: ProductionRangeExportDto | null,
): string {
  const lines: string[] = [];
  lines.push(buildCsvLine(["Reporte generado", new Date().toISOString()]));
  lines.push(buildCsvLine(["Fecha desde (filtro resumen)", dateFrom || "(vacío = todo)"]));
  lines.push(buildCsvLine(["Fecha hasta (filtro resumen)", dateTo || "(vacío = todo)"]));
  lines.push("");
  lines.push("RESUMEN");
  lines.push(buildCsvLine(["Facturas conteo", summary.invoicesCount]));
  lines.push(buildCsvLine(["Total facturado", summary.totalBilled]));
  lines.push(buildCsvLine(["Total cobrado", summary.totalPaid]));
  lines.push(buildCsvLine(["Pendiente por cobrar", summary.totalPending]));
  lines.push(buildCsvLine(["Costo producción", summary.productionTotalCost]));
  lines.push(buildCsvLine(["Pagado producción", summary.productionPaid]));
  lines.push(buildCsvLine(["Pendiente producción", summary.productionPending]));
  lines.push("");
  lines.push("TOP DEUDORES");
  lines.push(buildCsvLine(["Codigo", "Cliente", "Balance"]));
  for (const d of debtors) {
    lines.push(buildCsvLine([d.clientCode, d.clientName, d.balance]));
  }
  if (dateFrom && dateTo) {
    lines.push("");
    lines.push("FACTURAS_EN_RANGO");
    const filtered = invoices.filter((inv) => inv.date >= dateFrom && inv.date <= dateTo);
    lines.push(buildCsvLine(["Numero", "Cliente", "Fecha", "Total", "Pagado", "Pendiente", "Estado"]));
    for (const inv of filtered) {
      lines.push(
        buildCsvLine([
          inv.invoiceNumber,
          inv.clientName,
          inv.date,
          inv.total,
          inv.paid,
          inv.balance,
          inv.status,
        ]),
      );
    }

    if (productionInRange) {
      lines.push("");
      lines.push("PRODUCCION_LOTES_EN_RANGO");
      lines.push(
        buildCsvLine([
          "LoteId",
          "Tipo",
          "Fecha",
          "Trabajador",
          "CostoTotal",
          "Pagado",
          "Pendiente",
          "Notas",
        ]),
      );
      for (const b of productionInRange.batches) {
        lines.push(
          buildCsvLine([
            b.id,
            b.type,
            b.date,
            b.workerName ?? "",
            b.totalCost,
            b.paid,
            b.pending,
            b.notes ?? "",
          ]),
        );
      }
      lines.push("");
      lines.push("PRODUCCION_LINEAS_EN_RANGO");
      lines.push(
        buildCsvLine([
          "LoteId",
          "FechaLote",
          "TipoLote",
          "Trabajador",
          "LineaId",
          "ClienteCodigo",
          "ClienteNombre",
          "Formato",
          "Categoria",
          "Cantidad",
          "CostoUnitario",
          "Subtotal",
        ]),
      );
      for (const row of productionInRange.lines) {
        lines.push(
          buildCsvLine([
            row.batchId,
            row.batchDate,
            row.batchType,
            row.workerName ?? "",
            row.lineId,
            row.clientCode,
            row.clientName,
            row.formatLabel ?? "",
            row.category,
            row.quantity,
            row.unitCost,
            row.subtotal,
          ]),
        );
      }
    }
  }
  return lines.join("\r\n");
}

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

  const exportFilename = useMemo(() => {
    const d = new Date().toISOString().slice(0, 10);
    return `reportes-${d}.csv`;
  }, []);

  const handleExportCsv = () => {
    if (!summaryQuery.data || !debtorsQuery.data || !invoicesQuery.data) return;
    const productionInRange =
      rangeSelected && productionRangeQuery.data ? productionRangeQuery.data : null;
    const csv = buildReportsCsv(
      dateFrom,
      dateTo,
      summaryQuery.data,
      debtorsQuery.data,
      invoicesQuery.data,
      productionInRange,
    );
    downloadTextFile(exportFilename, csv);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-sm text-base-content/70">Métricas de ventas/cobros y cuentas por cobrar.</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" disabled={!canExport} onClick={() => handleExportCsv()}>
          Exportar CSV
        </button>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-base">Filtro de fechas (facturas y producción)</h2>
          <p className="text-xs text-base-content/60">
            El resumen usa este rango. Con &quot;desde&quot; y &quot;hasta&quot; rellenados, el CSV incluye facturas en
            rango, lotes de producción (cabeceras) y todas sus líneas en ese rango de fechas de lote.
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
            <p className="text-base-content/60 text-sm mt-2">Cargando datos de producción para el CSV...</p>
          )}
        </div>
      </div>

      {summaryQuery.isLoading && <p>Cargando resumen...</p>}
      {summaryQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudo cargar el resumen.</span>
        </div>
      )}
      {summaryQuery.data && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="stat bg-base-100 rounded-box shadow">
            <div className="stat-title">Facturas</div>
            <div className="stat-value text-2xl">{summaryQuery.data.invoicesCount}</div>
          </div>
          <div className="stat bg-base-100 rounded-box shadow">
            <div className="stat-title">Total facturado</div>
            <div className="stat-value text-2xl">{money.format(summaryQuery.data.totalBilled)}</div>
          </div>
          <div className="stat bg-base-100 rounded-box shadow">
            <div className="stat-title">Total cobrado</div>
            <div className="stat-value text-2xl">{money.format(summaryQuery.data.totalPaid)}</div>
          </div>
          <div className="stat bg-base-100 rounded-box shadow">
            <div className="stat-title">Pendiente por cobrar</div>
            <div className="stat-value text-2xl">{money.format(summaryQuery.data.totalPending)}</div>
          </div>
          <div className="stat bg-base-100 rounded-box shadow">
            <div className="stat-title">Costo producción</div>
            <div className="stat-value text-2xl">{money.format(summaryQuery.data.productionTotalCost)}</div>
          </div>
          <div className="stat bg-base-100 rounded-box shadow">
            <div className="stat-title">Pagado producción</div>
            <div className="stat-value text-2xl">{money.format(summaryQuery.data.productionPaid)}</div>
          </div>
          <div className="stat bg-base-100 rounded-box shadow md:col-span-2">
            <div className="stat-title">Pendiente producción</div>
            <div className="stat-value text-2xl">{money.format(summaryQuery.data.productionPending)}</div>
          </div>
        </div>
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
                        <td className="text-right">{money.format(row.balance)}</td>
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
