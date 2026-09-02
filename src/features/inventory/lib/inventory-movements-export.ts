import { formatDate, todayIso } from "@/lib/format-date";
import type { ReportTableSection } from "@/lib/report-export";
import type { InventoryMovementListDto } from "@/types/inventory";

/** Periodo rápido del listado de movimientos de inventario. */
export type InventoryMovementPeriod = "hoy" | "mes" | "todos";

/**
 * Etiqueta del periodo para cabeceras y nombres de archivo.
 *
 * @param period - Periodo activo.
 * @returns Texto en español con fecha `dd/mm/aaaa` cuando aplica.
 */
export function inventoryMovementsPeriodLabel(period: InventoryMovementPeriod): string {
  const today = todayIso();
  switch (period) {
    case "hoy":
      return `Día ${formatDate(today)}`;
    case "mes": {
      const parts = today.slice(0, 7).split("-");
      return parts.length === 2 ? `Mes ${parts[1]}/${parts[0]}` : "Mes actual";
    }
    default:
      return "Todos";
  }
}

/**
 * Etiqueta de tipo de movimiento para tablas y exportes.
 *
 * @param type - `entrada` | `salida`.
 * @returns Texto en español.
 */
function movementTypeLabel(type: string): string {
  if (type === "entrada") {
    return "Entrada";
  }
  if (type === "salida") {
    return "Salida";
  }
  return type;
}

/**
 * Totales del listado (cantidades físicas, no importes).
 *
 * @param rows - Movimientos del periodo.
 * @returns Conteos de entradas, salidas, mermas y ventas.
 */
function summarizeMovements(rows: InventoryMovementListDto[]): {
  count: number;
  entradas: number;
  salidas: number;
  mermas: number;
  ventas: number;
} {
  let entradas = 0;
  let salidas = 0;
  let mermas = 0;
  let ventas = 0;
  for (const row of rows) {
    if (row.movementType === "entrada") {
      entradas += row.quantity;
    } else if (row.movementType === "salida") {
      salidas += row.quantity;
      if (row.method === "Merma") {
        mermas += row.quantity;
      } else if (row.method === "Venta") {
        ventas += row.quantity;
      }
    }
  }
  return { count: rows.length, entradas, salidas, mermas, ventas };
}

/**
 * Secciones Excel/PDF del listado de movimientos filtrado.
 *
 * @param rows - Movimientos del periodo.
 * @param periodLabel - Etiqueta del periodo.
 * @returns Tablas para el exporte.
 */
export function buildInventoryMovementsExportSections(
  rows: InventoryMovementListDto[],
  periodLabel: string,
): ReportTableSection[] {
  const totals = summarizeMovements(rows);
  return [
    {
      name: "METADATOS",
      aoa: [
        ["Campo", "Valor"],
        ["Periodo", periodLabel],
        ["Movimientos", totals.count],
        ["Entradas", totals.entradas],
        ["Salidas", totals.salidas],
        ["Mermas", totals.mermas],
        ["Ventas", totals.ventas],
      ],
    },
    {
      name: "MOVIMIENTOS_INVENTARIO",
      aoa: [
        ["Fecha", "Material", "Tipo", "Cantidad", "Motivo", "Método"],
        ...rows.map((row) => [
          formatDate(row.date),
          row.itemName,
          movementTypeLabel(row.movementType),
          row.quantity,
          row.reason ?? "—",
          row.method,
        ]),
      ],
    },
  ];
}
