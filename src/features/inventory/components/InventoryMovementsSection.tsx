import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { fetchInventoryMovementsList } from "@/db/queries/inventory";
import {
  buildInventoryMovementsExportSections,
  inventoryMovementsPeriodLabel,
  type InventoryMovementPeriod,
} from "@/features/inventory/lib/inventory-movements-export";
import { reportExportBasename } from "@/features/reports/lib/report-period";
import { formatDate } from "@/lib/format-date";
import {
  downloadReportsXlsx,
  openReportsPrintablePdf,
} from "@/lib/report-export";

const PERIOD_OPTIONS: { id: InventoryMovementPeriod; label: string }[] = [
  { id: "hoy", label: "Día actual" },
  { id: "mes", label: "Mes actual" },
  { id: "todos", label: "Todos" },
];

/**
 * Sección de movimientos globales de inventario con filtro Día/Mes/Todos
 * (por defecto mes actual) y exporte Excel/PDF del periodo activo.
 *
 * @returns Bloque de UI para la pantalla principal de Inventario.
 */
export function InventoryMovementsSection() {
  const [period, setPeriod] = useState<InventoryMovementPeriod>("mes");
  const [exporting, setExporting] = useState(false);
  const [exportFlash, setExportFlash] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const movementsQuery = useQuery({
    queryKey: ["inventory", "movements", "list", period],
    queryFn: () => fetchInventoryMovementsList(period),
  });

  const movements = movementsQuery.data ?? [];
  const periodLabel = inventoryMovementsPeriodLabel(period);
  const canExport = movementsQuery.isSuccess && !exporting;

  const handleExcel = async () => {
    if (!canExport) {
      return;
    }
    setExporting(true);
    setExportError(null);
    setExportFlash(null);
    try {
      const basename = reportExportBasename("Movimientos de inventario", periodLabel);
      const path = await downloadReportsXlsx(
        basename,
        buildInventoryMovementsExportSections(movements, periodLabel),
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
        `Movimientos de inventario · ${periodLabel}`,
        buildInventoryMovementsExportSections(movements, periodLabel),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExportError(message || "No se pudo abrir la impresión PDF.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Movimientos de materiales de inventario</h2>
          <p className="text-xs text-base-content/60">
            Filtra la tabla de forma rápida. Por defecto: mes actual. Las ventas de material
            aparecen como método <span className="font-medium">Venta</span>. Excel y PDF usan este
            mismo periodo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="join" role="group" aria-label="Filtrar movimientos por periodo">
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

      {movementsQuery.isLoading && (
        <p className="text-sm text-base-content/60">Cargando movimientos…</p>
      )}
      {movementsQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudieron cargar los movimientos.</span>
        </div>
      )}

      {movementsQuery.data && (
        <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Material</th>
                <th>Tipo</th>
                <th className="text-right">Cantidad</th>
                <th>Motivo</th>
                <th>Método</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((mov) => (
                <tr key={mov.id}>
                  <td className="text-xs whitespace-nowrap">{formatDate(mov.date)}</td>
                  <td>
                    <Link
                      to="/inventario/$itemId"
                      params={{ itemId: String(mov.itemId) }}
                      className="link link-hover font-medium"
                    >
                      {mov.itemName}
                    </Link>
                  </td>
                  <td>
                    <span
                      className={`badge badge-sm ${
                        mov.movementType === "entrada" ? "badge-success" : "badge-warning"
                      }`}
                    >
                      {mov.movementType === "entrada" ? "Entrada" : "Salida"}
                    </span>
                  </td>
                  <td className="text-right">{mov.quantity}</td>
                  <td className="max-w-[16rem] truncate" title={mov.reason ?? undefined}>
                    {mov.reason ?? "—"}
                  </td>
                  <td>
                    {mov.method === "Manual" ? (
                      <span className="badge badge-sm badge-ghost">{mov.method}</span>
                    ) : mov.method === "Rebaja por Pedido" ? (
                      <span className="badge badge-sm badge-info">{mov.method}</span>
                    ) : mov.method === "Merma" ? (
                      <span className="badge badge-sm badge-warning">{mov.method}</span>
                    ) : mov.method === "Venta" ? (
                      <span className="badge badge-sm badge-success">{mov.method}</span>
                    ) : (
                      <span className="text-base-content/50">{mov.method}</span>
                    )}
                  </td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-base-content/60">
                    No hay movimientos en este periodo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
