/**
 * Escapes one cell for CSV (semicolon-separated, Excel-friendly in es-DO).
 */
export function escapeCsvCell(value: string | number): string {
  const s = String(value);
  if (/[;\n\r"]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsvLine(cells: (string | number)[]): string {
  return cells.map(escapeCsvCell).join(";");
}

/**
 * Triggers a file download in the browser / Tauri webview.
 */
export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8"): void {
  const blob = new Blob(["\uFEFF", content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
