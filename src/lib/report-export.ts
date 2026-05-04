import { buildCsvLine, downloadTextFile } from "@/lib/csv";
import type { InvoiceListDto } from "@/types/invoice";
import type { ProductionRangeExportDto } from "@/types/production";
import type { ReportsSummaryDto, TopDebtorDto } from "@/types/report";

const money = new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" });
const pct = new Intl.NumberFormat("es-DO", { style: "percent", maximumFractionDigits: 1 });

export type ReportTableSection = {
  name: string;
  /** First row = column headers when present. */
  aoa: (string | number)[][];
};

/**
 * Normalized blocks for CSV / XLSX / impresión PDF.
 */
export function buildReportTables(
  dateFrom: string,
  dateTo: string,
  summary: ReportsSummaryDto,
  debtors: TopDebtorDto[],
  invoices: InvoiceListDto[],
  productionInRange: ProductionRangeExportDto | null,
): ReportTableSection[] {
  const meta: ReportTableSection = {
    name: "METADATOS",
    aoa: [
      ["Campo", "Valor"],
      ["Reporte generado", new Date().toISOString()],
      ["Fecha desde (filtro resumen)", dateFrom || "(vacío = todo)"],
      ["Fecha hasta (filtro resumen)", dateTo || "(vacío = todo)"],
    ],
  };

  const resumen: ReportTableSection = {
    name: "RESUMEN",
    aoa: [
      ["Métrica", "Valor"],
      ["Facturas (conteo)", summary.invoicesCount],
      ["Facturas pagadas", summary.invoicesPaidCount],
      ["Facturas parciales", summary.invoicesPartialCount],
      ["Facturas pendientes", summary.invoicesPendingCount],
      ["Total facturado", summary.totalBilled],
      ["Total cobrado", summary.totalPaid],
      ["Pendiente por cobrar", summary.totalPending],
      ["Promedio factura", summary.averageInvoiceAmount],
      ["Tasa de cobro (cobrado / facturado)", summary.collectionRate],
      ["Clientes con saldo por cobrar (activos)", summary.clientsWithReceivablesCount],
      ["Costo producción", summary.productionTotalCost],
      ["Pagado producción", summary.productionPaid],
      ["Pendiente producción", summary.productionPending],
      ["Lotes de producción (conteo)", summary.productionBatchesCount],
    ],
  };

  const top: ReportTableSection = {
    name: "TOP_DEUDORES",
    aoa: [
      ["Codigo", "Cliente", "Balance"],
      ...debtors.map((d) => [d.clientCode, d.clientName, d.balance]),
    ],
  };

  const out: ReportTableSection[] = [meta, resumen, top];

  if (dateFrom && dateTo) {
    const filtered = invoices.filter((inv) => inv.date >= dateFrom && inv.date <= dateTo);
    out.push({
      name: "FACTURAS_EN_RANGO",
      aoa: [
        ["Numero", "Cliente", "Fecha", "Total", "Pagado", "Pendiente", "Estado"],
        ...filtered.map((inv) => [
          inv.invoiceNumber,
          inv.clientName,
          inv.date,
          inv.total,
          inv.paid,
          inv.balance,
          inv.status,
        ]),
      ],
    });

    if (productionInRange) {
      out.push({
        name: "PRODUCCION_LOTES",
        aoa: [
          ["LoteId", "Tipo", "Fecha", "Trabajador", "CostoTotal", "Pagado", "Pendiente", "Notas"],
          ...productionInRange.batches.map((b) => [
            b.id,
            b.type,
            b.date,
            b.workerName ?? "",
            b.totalCost,
            b.paid,
            b.pending,
            b.notes ?? "",
          ]),
        ],
      });
      out.push({
        name: "PRODUCCION_LINEAS",
        aoa: [
          [
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
          ],
          ...productionInRange.lines.map((row) => [
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
        ],
      });
    }
  }

  return out;
}

/** CSV con secciones separadas por línea en blanco (comportamiento previo). */
export function buildReportsCsvFromTables(sections: ReportTableSection[]): string {
  const lines: string[] = [];
  for (const sec of sections) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(sec.name);
    for (const row of sec.aoa) {
      lines.push(buildCsvLine(row));
    }
  }
  return lines.join("\r\n");
}

function sanitizeSheetName(name: string): string {
  const s = name.replace(/[:\\/?*[\]]/g, "_").slice(0, 31);
  return s || "Hoja";
}

export async function downloadReportsXlsx(baseFilename: string, sections: ReportTableSection[]): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const sec of sections) {
    const ws = XLSX.utils.aoa_to_sheet(sec.aoa);
    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(sec.name));
  }
  const name = baseFilename.toLowerCase().endsWith(".xlsx") ? baseFilename : `${baseFilename}.xlsx`;
  XLSX.writeFile(wb, name);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPrintCell(secName: string, col: number, rowIdx: number, label: string, v: string | number): string {
  const n = typeof v === "number" ? v : Number(v);
  const nn = Number.isFinite(n) ? n : 0;
  if (secName === "RESUMEN" && col === 1 && rowIdx >= 1) {
    if (label.includes("Tasa de cobro")) {
      return escapeHtml(pct.format(nn));
    }
    if (
      label.includes("(conteo)") ||
      label.includes("Facturas pagadas") ||
      label.includes("Facturas parciales") ||
      label.includes("Facturas pendientes") ||
      label.includes("Clientes con saldo") ||
      label.includes("Lotes de producción")
    ) {
      return escapeHtml(String(Math.round(nn)));
    }
    return escapeHtml(money.format(nn));
  }
  if (secName === "TOP_DEUDORES" && col === 2 && rowIdx >= 1) {
    return escapeHtml(money.format(nn));
  }
  if (secName === "FACTURAS_EN_RANGO" && col >= 3 && col <= 5 && rowIdx >= 1) {
    return escapeHtml(money.format(nn));
  }
  if (secName === "PRODUCCION_LOTES" && col >= 4 && col <= 6 && rowIdx >= 1) {
    return escapeHtml(money.format(nn));
  }
  if (secName === "PRODUCCION_LINEAS" && col >= 10 && rowIdx >= 1) {
    return escapeHtml(money.format(nn));
  }
  return escapeHtml(String(v));
}

/**
 * Abre una ventana con el reporte listo para **Imprimir → Guardar como PDF** (sin dependencias extra).
 */
export function openReportsPrintablePdf(title: string, sections: ReportTableSection[]): void {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    return;
  }

  const parts: string[] = [];
  parts.push(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>`);
  parts.push(`<style>
    body{font-family:system-ui,sans-serif;padding:16px;color:#111;font-size:11pt}
    h1{font-size:16pt;margin:0 0 12px}
    h2{font-size:12pt;margin:20px 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px}
    table{border-collapse:collapse;width:100%;margin-bottom:12px}
    th,td{border:1px solid #bbb;padding:6px 8px;text-align:left}
    th{background:#f0f0f0;font-weight:600}
    td.num{text-align:right;font-variant-numeric:tabular-nums}
    @media print{body{padding:8px}}
  </style></head><body>`);
  parts.push(`<h1>${escapeHtml(title)}</h1>`);

  for (const sec of sections) {
    parts.push(`<h2>${escapeHtml(sec.name)}</h2>`);
    if (sec.aoa.length === 0) {
      continue;
    }
    const header = sec.aoa[0];
    const bodyRows = sec.aoa.slice(1);
    parts.push("<table><thead><tr>");
    for (let i = 0; i < header.length; i++) {
      parts.push(`<th>${escapeHtml(String(header[i]))}</th>`);
    }
    parts.push("</tr></thead><tbody>");
    for (let r = 0; r < bodyRows.length; r++) {
      parts.push("<tr>");
      const row = bodyRows[r];
      const label = String(row[0] ?? "");
      for (let c = 0; c < header.length; c++) {
        const raw = row[c] ?? "";
        const numCols =
          (sec.name === "RESUMEN" && c === 1) ||
          (sec.name === "TOP_DEUDORES" && c === 2) ||
          (sec.name === "FACTURAS_EN_RANGO" && c >= 3 && c <= 5) ||
          (sec.name === "PRODUCCION_LOTES" && c >= 4 && c <= 6) ||
          (sec.name === "PRODUCCION_LINEAS" && c >= 10);
        const cls = numCols ? ' class="num"' : "";
        parts.push(`<td${cls}>${formatPrintCell(sec.name, c, r + 1, label, raw)}</td>`);
      }
      parts.push("</tr>");
    }
    parts.push("</tbody></table>");
  }

  parts.push(`<p style="margin-top:16px;font-size:9pt;color:#555">Use el cuadro de impresión del sistema y elija &quot;Guardar como PDF&quot; o &quot;Microsoft Print to PDF&quot;.</p>`);
  parts.push("</body></html>");
  w.document.write(parts.join(""));
  w.document.close();
  w.focus();
  requestAnimationFrame(() => {
    w.print();
  });
}

export function downloadReportsCsv(filename: string, content: string): void {
  downloadTextFile(filename, content);
}
