import { invoke } from "@tauri-apps/api/core";
import { buildCsvLine, downloadTextFile } from "@/lib/csv";
import { formatMoney } from "@/lib/format-money";
import type { InvoiceListDto } from "@/types/invoice";
import type { ProductionRangeExportDto } from "@/types/production";
import type { ReportsSummaryDto, TopDebtorDto } from "@/types/report";

const pct = new Intl.NumberFormat("es", { style: "percent", maximumFractionDigits: 1 });

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
      ["Total facturado CUP", summary.totalBilledCup],
      ["Total facturado USD", summary.totalBilledUsd],
      ["Pendiente CUP", summary.totalPendingCup],
      ["Pendiente USD", summary.totalPendingUsd],
      ["Total facturado (equiv. CUP)", summary.totalBilled],
      ["Total cobrado (equiv. CUP)", summary.totalPaid],
      ["Pendiente por cobrar (equiv. CUP)", summary.totalPending],
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
      ["Codigo", "Cliente", "Balance USD", "Balance CUP", "Equiv. CUP"],
      ...debtors.map((d) => [d.clientCode, d.clientName, d.balanceUsd, d.balanceCup, d.balance]),
    ],
  };

  const out: ReportTableSection[] = [meta, resumen, top];

  if (dateFrom && dateTo) {
    const filtered = invoices.filter((inv) => inv.date >= dateFrom && inv.date <= dateTo);
    out.push({
      name: "FACTURAS_EN_RANGO",
      aoa: [
        ["Numero", "Cliente", "Fecha", "A cobrar USD", "A cobrar CUP", "Pendiente USD", "Pendiente equiv. CUP", "Estado"],
        ...filtered.map((inv) => [
          inv.invoiceNumber,
          inv.clientName,
          inv.date,
          inv.dueUsd,
          inv.dueCup,
          inv.balanceUsd,
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

/**
 * Genera un XLSX con una hoja por sección.
 * En Tauri abre el diálogo nativo de guardar; en el navegador descarga el archivo.
 *
 * @param baseFilename - Nombre de archivo (con o sin `.xlsx`).
 * @param sections - Tablas a exportar.
 * @returns Ruta o nombre guardado, o `null` si el usuario canceló.
 */
export async function downloadReportsXlsx(
  baseFilename: string,
  sections: ReportTableSection[],
): Promise<string | null> {
  const name = baseFilename.toLowerCase().endsWith(".xlsx")
    ? baseFilename
    : `${baseFilename}.xlsx`;

  const isTauri =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  if (isTauri) {
    try {
      return await invoke<string>("export_operational_xlsx", {
        fileName: name,
        sections,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("cancel")) {
        return null;
      }
      throw new Error(message || "No se pudo guardar el Excel.");
    }
  }

  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const sec of sections) {
    const ws = XLSX.utils.aoa_to_sheet(sec.aoa);
    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(sec.name));
  }
  XLSX.writeFile(wb, name);
  return name;
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
    return escapeHtml(formatMoney(nn));
  }
  if (secName === "TOP_DEUDORES" && col === 2 && rowIdx >= 1) {
    return escapeHtml(formatMoney(nn));
  }
  if (secName === "FACTURAS_EN_RANGO" && col >= 3 && col <= 5 && rowIdx >= 1) {
    return escapeHtml(formatMoney(nn));
  }
  if (secName === "PRODUCCION_LOTES" && col >= 4 && col <= 6 && rowIdx >= 1) {
    return escapeHtml(formatMoney(nn));
  }
  if (secName === "PRODUCCION_LINEAS" && col >= 10 && rowIdx >= 1) {
    return escapeHtml(formatMoney(nn));
  }
  return escapeHtml(String(v));
}

/**
 * Construye el HTML imprimible de las secciones del informe.
 *
 * @param title - Título del documento.
 * @param sections - Tablas a renderizar.
 * @returns Documento HTML completo.
 */
function buildReportsPrintHtml(title: string, sections: ReportTableSection[]): string {
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
  return parts.join("");
}

/**
 * Abre el cuadro de impresión del sistema (en Tauri: Guardar como PDF).
 * No usa `window.open` porque WebView2 lo bloquea.
 *
 * @param title - Título del informe.
 * @param sections - Tablas a imprimir.
 */
export function openReportsPrintablePdf(title: string, sections: ReportTableSection[]): void {
  const html = buildReportsPrintHtml(title, sections);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "Vista de impresión");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "8.5in";
  iframe.style.height = "11in";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.zIndex = "-1";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentDocument;
  const frameWin = iframe.contentWindow;
  if (!frameDoc || !frameWin) {
    iframe.remove();
    throw new Error("No se pudo abrir la vista de impresión.");
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const cleanup = () => {
    iframe.remove();
  };
  frameWin.addEventListener("afterprint", cleanup);
  window.setTimeout(cleanup, 120_000);

  frameWin.focus();
  frameWin.print();
}

export function downloadReportsCsv(filename: string, content: string): void {
  downloadTextFile(filename, content);
}
