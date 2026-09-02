import { formatDate, formatDateTime } from "@/lib/format-date";
import type { ReportTableSection } from "@/lib/report-export";
import type { CashControlCurrencyDto, CashControlDayDto } from "@/types/cashflow";

/**
 * Etiqueta del periodo para cabeceras y nombres de archivo.
 *
 * @param scope - `mes` o `dia`.
 * @param month - Mes `YYYY-MM`.
 * @param day - Día `YYYY-MM-DD`.
 * @returns Texto en español (`Mes 09/2026` o `Día dd/mm/aaaa`).
 */
export function cashControlPeriodLabel(
  scope: "mes" | "dia",
  month: string,
  day: string,
): string {
  if (scope === "dia") {
    return `Día ${formatDate(day)}`;
  }
  const parts = month.split("-");
  return parts.length === 2 ? `Mes ${parts[1]}/${parts[0]}` : month;
}

/**
 * Estado del saldo inicial de una moneda.
 *
 * @param data - Totales de la moneda.
 * @param isDay - Si el alcance es día.
 * @returns Texto para metadatos.
 */
function openingStatusLabel(data: CashControlCurrencyDto, isDay: boolean): string {
  if (data.hasOpening) {
    return "Registrado";
  }
  if (data.openingTotal > 0) {
    return isDay ? "Estimado desde el mes" : "Estimado";
  }
  return "Sin registrar";
}

/**
 * Hoja de monitoreo por denominación (inicial, entradas, salidas, estimado).
 *
 * @param name - Nombre de sección.
 * @param data - Totales y líneas de una moneda.
 * @param isDay - Si el alcance es día.
 * @returns Tabla para Excel/PDF.
 */
function denominationMonitorSection(
  name: string,
  data: CashControlCurrencyDto,
  isDay: boolean,
): ReportTableSection {
  const inicialLabel = isDay ? "Inicial del día" : "Inicial";
  return {
    name,
    aoa: [
      ["Denominación", inicialLabel, "Entradas", "Salidas", "Estimado", "Subtotal"],
      ...data.lines.map((line) => [
        line.denomination,
        line.openingQty,
        line.inQty,
        line.outQty,
        line.estimatedQty,
        line.estimatedSubtotal,
      ]),
      [
        "TOTAL",
        data.openingTotal,
        data.inTotal,
        data.outTotal,
        data.estimatedTotal,
        data.estimatedTotal,
      ],
    ],
  };
}

/**
 * Hoja de desglose del saldo inicial por denominación.
 *
 * @param name - Nombre de sección.
 * @param data - Totales y líneas de una moneda.
 * @returns Tabla para Excel/PDF.
 */
function openingBreakdownSection(
  name: string,
  data: CashControlCurrencyDto,
): ReportTableSection {
  return {
    name,
    aoa: [
      ["Denominación", "Cantidad", "Subtotal"],
      ...data.lines.map((line) => [line.denomination, line.openingQty, line.openingSubtotal]),
      ["TOTAL", "", data.openingTotal],
    ],
  };
}

/**
 * Secciones Excel/PDF del control de efectivo visible (Mes o Día, CUP y USD).
 *
 * @param params - Alcance, totales duales, notas del conteo y días del mes.
 * @returns Tablas para el exporte.
 */
export function buildCashControlExportSections(params: {
  scope: "mes" | "dia";
  periodLabel: string;
  cup: CashControlCurrencyDto;
  usd: CashControlCurrencyDto;
  openingUpdatedAt: string | null;
  notes: string | null;
  days: CashControlDayDto[];
  showLedgerGapWarning: boolean;
}): ReportTableSection[] {
  const {
    scope,
    periodLabel,
    cup,
    usd,
    openingUpdatedAt,
    notes,
    days,
    showLedgerGapWarning,
  } = params;
  const isDay = scope === "dia";
  const estimadoLabel = isDay ? "Estimado al cierre" : "Estimado";

  const sections: ReportTableSection[] = [
    {
      name: "METADATOS",
      aoa: [
        ["Campo", "Valor"],
        ["Alcance", isDay ? "Día" : "Mes"],
        ["Periodo", periodLabel],
        ["Saldo inicial CUP", openingStatusLabel(cup, isDay)],
        ["Saldo inicial USD", openingStatusLabel(usd, isDay)],
        ["Actualizado", openingUpdatedAt ? formatDateTime(openingUpdatedAt) : "—"],
        ["Notas", notes?.trim() ? notes.trim() : "—"],
        ["Libro CUP", cup.ledgerBalance],
        ["Libro USD", usd.ledgerBalance],
        [
          "Aviso",
          showLedgerGapWarning
            ? "El estimado de billetes puede diferir del libro: las transferencias y el efectivo sin desglose no entran en este conteo."
            : "—",
        ],
      ],
    },
    {
      name: "CONTROL_RESUMEN",
      aoa: [
        ["Métrica", "CUP", "USD"],
        ["Inicial", cup.openingTotal, usd.openingTotal],
        ["Entradas", cup.inTotal, usd.inTotal],
        ["Salidas", cup.outTotal, usd.outTotal],
        [estimadoLabel, cup.estimatedTotal, usd.estimatedTotal],
      ],
    },
    denominationMonitorSection("CONTROL_DENOM_CUP", cup, isDay),
    denominationMonitorSection("CONTROL_DENOM_USD", usd, isDay),
    openingBreakdownSection("CONTROL_INICIAL_CUP", cup),
    openingBreakdownSection("CONTROL_INICIAL_USD", usd),
  ];

  if (!isDay) {
    sections.push({
      name: "CONTROL_DIAS",
      aoa: [
        [
          "Fecha",
          "Entradas CUP",
          "Salidas CUP",
          "Estimado CUP",
          "Entradas USD",
          "Salidas USD",
          "Estimado USD",
          "Saldo declarado",
          "Movimiento",
        ],
        ...days.map((row) => [
          formatDate(row.date),
          row.inTotalCup,
          row.outTotalCup,
          row.estimatedTotalCup,
          row.inTotalUsd,
          row.outTotalUsd,
          row.estimatedTotalUsd,
          row.hasDeclaredOpening ? "Sí" : "No",
          row.hasMovement ? "Sí" : "No",
        ]),
      ],
    });
  }

  return sections;
}
