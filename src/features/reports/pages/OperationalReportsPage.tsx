import { useCallback, useMemo, useState } from "react";
import { BarChart3, FileSpreadsheet, FileText } from "lucide-react";
import { BillingReport } from "@/features/reports/components/BillingReport";
import { CashflowReportView } from "@/features/reports/components/CashflowReportView";
import { ExpensesReport } from "@/features/reports/components/ExpensesReport";
import { InventoryConsumptionReport } from "@/features/reports/components/InventoryConsumptionReport";
import { InventoryMovementsReport } from "@/features/reports/components/InventoryMovementsReport";
import { PayrollReport } from "@/features/reports/components/PayrollReport";
import { ProductionAreaReport } from "@/features/reports/components/ProductionAreaReport";
import { ProductionDailyReport } from "@/features/reports/components/ProductionDailyReport";
import { ReceivablesReport } from "@/features/reports/components/ReceivablesReport";
import { ReportPeriodBar } from "@/features/reports/components/ReportPeriodBar";
import type { OperationalReportViewProps } from "@/features/reports/components/report-view-props";
import {
  ACCOUNTING_REPORTS,
  PRODUCTION_REPORTS,
  defaultReportPeriod,
  operationalReportTitle,
  reportExportBasename,
  reportPeriodLabel,
  resolveReportRange,
  type AccountingReportId,
  type OperationalReportId,
  type ProductionReportId,
  type ReportGroupId,
  type ReportPeriodState,
} from "@/features/reports/lib/report-period";
import {
  downloadReportsXlsx,
  openReportsPrintablePdf,
  type ReportTableSection,
} from "@/lib/report-export";

/**
 * Hub de reportes operativos: un periodo, un grupo y un informe a la vez.
 *
 * @returns Página de Reportes.
 */
export function OperationalReportsPage() {
  const [period, setPeriod] = useState<ReportPeriodState>(defaultReportPeriod);
  const [group, setGroup] = useState<ReportGroupId>("produccion");
  const [productionId, setProductionId] = useState<ProductionReportId>("area");
  const [accountingId, setAccountingId] = useState<AccountingReportId>("nomina");
  const [exportSections, setExportSections] = useState<ReportTableSection[] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportFlash, setExportFlash] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const range = useMemo(() => resolveReportRange(period), [period]);
  const periodLabel = useMemo(() => reportPeriodLabel(period), [period]);
  const activeId: OperationalReportId = group === "produccion" ? productionId : accountingId;
  const reportTitle = operationalReportTitle(activeId);
  const pills = group === "produccion" ? PRODUCTION_REPORTS : ACCOUNTING_REPORTS;
  const queryEnabled = range.ready || activeId === "deudores";

  const onSectionsChange = useCallback((sections: ReportTableSection[] | null) => {
    setExportSections(sections);
  }, []);

  const viewProps: OperationalReportViewProps = {
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    enabled: queryEnabled,
    periodLabel,
    onSectionsChange,
  };

  const handleExcel = async () => {
    if (!exportSections) {
      setExportError("Espere a que cargue el informe para exportar.");
      return;
    }
    setExporting(true);
    setExportError(null);
    setExportFlash(null);
    try {
      const basename = reportExportBasename(reportTitle, periodLabel);
      const path = await downloadReportsXlsx(basename, exportSections);
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
    if (!exportSections) {
      setExportError("Espere a que cargue el informe para exportar.");
      return;
    }
    setExportError(null);
    setExportFlash(null);
    try {
      const title = `Reportes · ${reportTitle} · ${periodLabel}`;
      openReportsPrintablePdf(title, exportSections);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExportError(message || "No se pudo abrir la impresión PDF.");
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BarChart3 className="h-6 w-6" /> Reportes
          </h1>
          <p className="text-sm text-base-content/60">{periodLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm gap-1"
            disabled={!exportSections || exporting}
            onClick={() => void handleExcel()}
          >
            <FileSpreadsheet className="h-4 w-4" /> {exporting ? "Guardando…" : "Excel"}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm gap-1"
            disabled={!exportSections || exporting}
            onClick={handlePdf}
          >
            <FileText className="h-4 w-4" /> PDF
          </button>
        </div>
      </div>

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

      <ReportPeriodBar value={period} onChange={setPeriod} />

      <div role="tablist" className="tabs tabs-boxed w-fit bg-base-200">
        <button
          type="button"
          role="tab"
          className={`tab ${group === "produccion" ? "tab-active" : ""}`}
          onClick={() => {
            setGroup("produccion");
            setExportSections(null);
          }}
        >
          Producción
        </button>
        <button
          type="button"
          role="tab"
          className={`tab ${group === "contabilidad" ? "tab-active" : ""}`}
          onClick={() => {
            setGroup("contabilidad");
            setExportSections(null);
          }}
        >
          Nómina y Contabilidad
        </button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Informe">
        {pills.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`btn btn-sm ${activeId === item.id ? "btn-primary" : "btn-ghost"}`}
            onClick={() => {
              setExportSections(null);
              if (group === "produccion") {
                setProductionId(item.id as ProductionReportId);
              } else {
                setAccountingId(item.id as AccountingReportId);
              }
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {activeId === "deudores" ? null : !range.ready ? (
        <p className="text-sm text-warning">Indique un rango Desde / Hasta válido.</p>
      ) : null}

      {group === "produccion" && productionId === "area" ? (
        <ProductionAreaReport {...viewProps} />
      ) : null}
      {group === "produccion" && productionId === "diario" ? (
        <ProductionDailyReport {...viewProps} />
      ) : null}
      {group === "produccion" && productionId === "consumo" ? (
        <InventoryConsumptionReport {...viewProps} />
      ) : null}
      {group === "produccion" && productionId === "movimientos" ? (
        <InventoryMovementsReport {...viewProps} />
      ) : null}
      {group === "contabilidad" && accountingId === "nomina" ? (
        <PayrollReport {...viewProps} />
      ) : null}
      {group === "contabilidad" && accountingId === "facturacion" ? (
        <BillingReport {...viewProps} />
      ) : null}
      {group === "contabilidad" && accountingId === "caja" ? (
        <CashflowReportView {...viewProps} />
      ) : null}
      {group === "contabilidad" && accountingId === "gastos" ? (
        <ExpensesReport {...viewProps} />
      ) : null}
      {group === "contabilidad" && accountingId === "deudores" ? (
        <ReceivablesReport {...viewProps} enabled />
      ) : null}
    </section>
  );
}
