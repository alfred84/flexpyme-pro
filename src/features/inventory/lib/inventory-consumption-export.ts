import { formatDate, todayIso } from "@/lib/format-date";
import type { ReportTableSection } from "@/lib/report-export";
import type { InventoryConsumptionPeriod } from "@/types/inventory";
import type { InventoryConsumptionGroup } from "@/features/inventory/lib/consumption-summary";

const CONSUMPTION_HEADERS = [
  "Formato",
  "Unidad",
  "Existencia inicial",
  "Entradas",
  "Salidas",
  "Solicitados",
  "Mermas",
  "Ventas",
  "Existencia final",
  "Demanda",
  "Déficit",
  "Disponible",
];

const EPS = 1e-9;

/**
 * Etiqueta del periodo para cabeceras y nombres de archivo.
 *
 * @param period - Día actual, mes actual o total.
 * @returns Texto en español con fecha `dd/mm/aaaa` cuando aplica.
 */
export function inventoryConsumptionPeriodLabel(
  period: InventoryConsumptionPeriod,
): string {
  const today = todayIso();
  switch (period) {
    case "hoy":
      return `Día ${formatDate(today)}`;
    case "mes": {
      const parts = today.slice(0, 7).split("-");
      return parts.length === 2 ? `Mes ${parts[1]}/${parts[0]}` : "Mes actual";
    }
    default:
      return "Total";
  }
}

/**
 * KPIs del listado visible (mismas métricas que la cabecera de la página).
 *
 * @param groups - Grupos a exportar.
 * @returns Totales de entradas, mermas, ventas e ítems con déficit.
 */
export function summarizeConsumptionGroups(groups: InventoryConsumptionGroup[]): {
  entradas: number;
  mermas: number;
  ventas: number;
  deficitItems: number;
  formatos: number;
} {
  let entradas = 0;
  let mermas = 0;
  let ventas = 0;
  let deficitItems = 0;
  let formatos = 0;
  for (const group of groups) {
    formatos += group.rows.length;
    for (const row of group.rows) {
      entradas += row.entradas;
      mermas += row.mermas;
      ventas += row.ventas;
      if (row.deficit > EPS) {
        deficitItems += 1;
      }
    }
  }
  return { entradas, mermas, ventas, deficitItems, formatos };
}

/**
 * Secciones Excel/PDF del resumen de consumo visible (periodo y tipo).
 *
 * @param groups - Grupos de material a incluir.
 * @param periodLabel - Periodo del kardex.
 * @param categoryFilterLabel - Tipo de material (`Todos` o el nombre del tipo).
 * @returns Tablas para el exporte.
 */
export function buildInventoryConsumptionExportSections(
  groups: InventoryConsumptionGroup[],
  periodLabel: string,
  categoryFilterLabel: string,
): ReportTableSection[] {
  const kpis = summarizeConsumptionGroups(groups);
  const sections: ReportTableSection[] = [
    {
      name: "METADATOS",
      aoa: [
        ["Campo", "Valor"],
        ["Periodo", periodLabel],
        ["Tipo de material", categoryFilterLabel],
        ["Formatos", kpis.formatos],
        ["Entradas", kpis.entradas],
        ["Mermas", kpis.mermas],
        ["Ventas", kpis.ventas],
        ["Ítems con déficit", kpis.deficitItems],
      ],
    },
  ];

  for (const group of groups) {
    sections.push({
      name: group.materialCategoryName.slice(0, 31) || "Tipo",
      aoa: [
        CONSUMPTION_HEADERS,
        ...group.rows.map((row) => [
          row.formato,
          row.unit,
          row.existenciaInicial,
          row.entradas,
          row.salidas,
          row.solicitados,
          row.mermas,
          row.ventas,
          row.existenciaFinal,
          row.demanda,
          row.deficit,
          row.disponible,
        ]),
        [
          "TOTAL",
          "",
          group.totals.existenciaInicial,
          group.totals.entradas,
          group.totals.salidas,
          group.totals.solicitados,
          group.totals.mermas,
          group.totals.ventas,
          group.totals.existenciaFinal,
          group.totals.demanda,
          group.totals.deficit,
          group.totals.disponible,
        ],
      ],
    });
  }

  return sections;
}
