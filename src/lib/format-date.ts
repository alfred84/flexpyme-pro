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
