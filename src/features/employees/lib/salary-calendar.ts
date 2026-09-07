import { monthEndIso, monthStartIso } from "@/lib/format-date";

export const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"] as const;

const MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

/**
 * Días del 1 al último del mes de `isoDate`.
 *
 * @param isoDate - Fecha ISO de referencia.
 * @returns Números de día del mes.
 */
export function daysOfMonth(isoDate: string): number[] {
  const lastDay = Number(monthEndIso(isoDate).slice(8, 10));
  if (!Number.isFinite(lastDay) || lastDay < 1) {
    return [];
  }
  return Array.from({ length: lastDay }, (_, index) => index + 1);
}

/**
 * Arma la fecha ISO del día `dayOfMonth` en el mes de `isoDate`.
 *
 * @param isoDate - Fecha ISO de referencia del mes.
 * @param dayOfMonth - Día 1..N.
 * @returns `YYYY-MM-DD`.
 */
export function isoForDayInMonth(isoDate: string, dayOfMonth: number): string {
  const month = monthStartIso(isoDate).slice(0, 7);
  return `${month}-${String(dayOfMonth).padStart(2, "0")}`;
}

/**
 * Extrae el día del mes (1..31) de una fecha ISO.
 *
 * @param isoDate - Fecha ISO.
 * @returns Día numérico o `null`.
 */
export function dayOfIso(isoDate: string | null): number | null {
  if (!isoDate || isoDate.length < 10) {
    return null;
  }
  const day = Number(isoDate.slice(8, 10));
  return Number.isFinite(day) && day >= 1 ? day : null;
}

/**
 * Índice 0..6 del primer día del mes, con lunes = 0.
 *
 * @param monthStart - Primer día del mes en ISO.
 * @returns Huecos vacíos al inicio de la cuadrícula.
 */
export function mondayFirstBlanks(monthStart: string): number {
  const parsed = new Date(`${monthStart}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }
  return (parsed.getDay() + 6) % 7;
}

/**
 * Título de mes en español (`Agosto 2026`).
 *
 * @param monthStart - Primer día del mes en ISO.
 * @returns Nombre del mes y año.
 */
export function monthTitleEs(monthStart: string): string {
  const monthIndex = Number(monthStart.slice(5, 7)) - 1;
  const year = monthStart.slice(0, 4);
  const name = MONTH_NAMES_ES[monthIndex];
  return name ? `${name} ${year}` : monthStart;
}
