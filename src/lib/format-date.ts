/**
 * Utilidades de formato de fecha para la UI.
 *
 * Toda fecha mostrada al usuario debe usar el formato `dd/mm/aaaa`
 * (ver regla `.cursor/rules/fechas.mdc`). Las fechas se almacenan en SQLite
 * como texto ISO (`YYYY-MM-DD` o `YYYY-MM-DD HH:MM:SS`).
 */

/**
 * Parsea una fecha ISO almacenada (`YYYY-MM-DD` o `YYYY-MM-DD HH:MM:SS`) a `Date`.
 *
 * @param value - Cadena de fecha ISO o `Date`.
 * @returns Objeto `Date` o `null` si el valor no es válido.
 */
function parseStoredDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const trimmed = value.trim();
  // Formato con hora: "YYYY-MM-DD HH:MM:SS" -> normalizar a ISO con T.
  const normalized = trimmed.includes(" ") ? trimmed.replace(" ", "T") : trimmed;
  // Solo fecha: interpretar como local para evitar corrimiento de zona horaria.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
  const parsed = dateOnly ? new Date(`${normalized}T00:00:00`) : new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formatea una fecha como `dd/mm/aaaa`.
 *
 * @param value - Fecha ISO almacenada o `Date`.
 * @param fallback - Texto a devolver si la fecha es inválida (por defecto `—`).
 * @returns Fecha en formato `dd/mm/aaaa` o el fallback.
 */
export function formatDate(value: string | Date | null | undefined, fallback = "—"): string {
  const date = parseStoredDate(value);
  if (!date) {
    return fallback;
  }
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formatea una fecha con hora como `dd/mm/aaaa HH:MM`.
 *
 * @param value - Fecha ISO almacenada o `Date`.
 * @param fallback - Texto a devolver si la fecha es inválida (por defecto `—`).
 * @returns Fecha y hora en formato `dd/mm/aaaa HH:MM` o el fallback.
 */
export function formatDateTime(value: string | Date | null | undefined, fallback = "—"): string {
  const date = parseStoredDate(value);
  if (!date) {
    return fallback;
  }
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatDate(date)} ${hours}:${minutes}`;
}

/**
 * Devuelve la fecha actual en formato ISO `YYYY-MM-DD` (para inputs y payloads).
 *
 * @returns Fecha de hoy como `YYYY-MM-DD`.
 */
export function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Devuelve el mes calendario actual en formato `YYYY-MM` (inputs `type="month"`).
 *
 * @returns Mes actual como `YYYY-MM`.
 */
export function currentMonthYm(): string {
  return todayIso().slice(0, 7);
}

/**
 * Primer día del mes de una fecha ISO, como `YYYY-MM-DD`.
 *
 * @param isoDate - Fecha ISO (`YYYY-MM-DD` o con hora).
 * @returns `YYYY-MM-01` del mismo mes, o la cadena recortada si no es válida.
 */
export function monthStartIso(isoDate: string): string {
  const day = isoDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return day;
  }
  return `${day.slice(0, 7)}-01`;
}

/**
 * Último día del mes de una fecha ISO, como `YYYY-MM-DD`.
 *
 * @param isoDate - Fecha ISO (`YYYY-MM-DD` o con hora).
 * @returns Último día del mismo mes, o la cadena recortada si no es válida.
 */
export function monthEndIso(isoDate: string): string {
  const day = isoDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return day;
  }
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const last = new Date(year, month, 0);
  const lastDay = String(last.getDate()).padStart(2, "0");
  return `${day.slice(0, 7)}-${lastDay}`;
}

/**
 * Ajusta una fecha ISO al mes indicado (`YYYY-MM`).
 * Si está fuera del mes, devuelve el primer o el último día de ese mes.
 *
 * @param isoDate - Fecha ISO (`YYYY-MM-DD` o con hora).
 * @param monthYm - Mes destino (`YYYY-MM`).
 * @returns Fecha ISO dentro del mes.
 */
export function clampIsoToMonth(isoDate: string, monthYm: string): string {
  const start = `${monthYm}-01`;
  const end = monthEndIso(start);
  const day = isoDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return start;
  }
  if (day < start) {
    return start;
  }
  if (day > end) {
    return end;
  }
  return day;
}
