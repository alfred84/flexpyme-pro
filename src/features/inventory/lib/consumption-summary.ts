import type { InventoryConsumptionRowDto } from "@/types/inventory";

/**
 * Totales de un grupo (tipo de material) del resumen de consumo.
 */
export interface InventoryConsumptionTotals {
  existenciaInicial: number;
  entradas: number;
  salidas: number;
  solicitados: number;
  mermas: number;
  ventas: number;
  existenciaFinal: number;
  demanda: number;
  deficit: number;
  disponible: number;
}

/**
 * Grupo del resumen: un tipo de material con sus ítems y totales.
 */
export interface InventoryConsumptionGroup {
  materialCategoryId: number | null;
  materialCategoryName: string;
  rows: InventoryConsumptionRowDto[];
  totals: InventoryConsumptionTotals;
}

/**
 * Formatea una cantidad de inventario para la tabla de resumen.
 *
 * @param value - Cantidad.
 * @returns Texto con hasta 2 decimales (es-ES).
 */
export function formatConsumptionQty(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  if (Math.abs(n - Math.round(n)) < 1e-9) {
    return String(Math.round(n));
  }
  return n.toLocaleString("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

/**
 * Agrupa filas de consumo por tipo de material y acumula totales.
 * Déficit y disponible se suman por ítem (los formatos no se sustituyen entre sí).
 *
 * @param rows - Filas planas del backend.
 * @returns Grupos ordenados por nombre de categoría.
 */
export function groupConsumptionByCategory(
  rows: InventoryConsumptionRowDto[],
): InventoryConsumptionGroup[] {
  const map = new Map<string, InventoryConsumptionGroup>();
  for (const row of rows) {
    const key = row.materialCategoryId == null ? "none" : String(row.materialCategoryId);
    let group = map.get(key);
    if (!group) {
      group = {
        materialCategoryId: row.materialCategoryId,
        materialCategoryName: row.materialCategoryName,
        rows: [],
        totals: emptyConsumptionTotals(),
      };
      map.set(key, group);
    }
    group.rows.push(row);
    addConsumptionTotals(group.totals, row);
  }
  return [...map.values()].sort((a, b) =>
    a.materialCategoryName.localeCompare(b.materialCategoryName, "es"),
  );
}

/**
 * Totales en cero para un grupo vacío.
 *
 * @returns Totales inicializados.
 */
function emptyConsumptionTotals(): InventoryConsumptionTotals {
  return {
    existenciaInicial: 0,
    entradas: 0,
    salidas: 0,
    solicitados: 0,
    mermas: 0,
    ventas: 0,
    existenciaFinal: 0,
    demanda: 0,
    deficit: 0,
    disponible: 0,
  };
}

/**
 * Acumula una fila en los totales del grupo.
 *
 * @param totals - Acumulador.
 * @param row - Fila de ítem.
 */
function addConsumptionTotals(
  totals: InventoryConsumptionTotals,
  row: InventoryConsumptionRowDto,
): void {
  totals.existenciaInicial += row.existenciaInicial;
  totals.entradas += row.entradas;
  totals.salidas += row.salidas;
  totals.solicitados += row.solicitados;
  totals.mermas += row.mermas;
  totals.ventas += row.ventas;
  totals.existenciaFinal += row.existenciaFinal;
  totals.demanda += row.demanda;
  totals.deficit += row.deficit;
  totals.disponible += row.disponible;
}
