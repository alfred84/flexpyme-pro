import { describe, expect, it } from "vitest";
import {
  defaultReportPeriod,
  operationalReportTitle,
  reportExportBasename,
  reportPeriodLabel,
  resolveReportRange,
  type ReportPeriodState,
} from "./report-period";

describe("resolveReportRange", () => {
  it("resuelve un día", () => {
    const state: ReportPeriodState = {
      ...defaultReportPeriod(),
      kind: "dia",
      day: "2026-08-31",
    };
    expect(resolveReportRange(state)).toEqual({
      dateFrom: "2026-08-31",
      dateTo: "2026-08-31",
      ready: true,
    });
  });

  it("resuelve un mes calendario", () => {
    const state: ReportPeriodState = {
      ...defaultReportPeriod(),
      kind: "mes",
      month: "2026-02",
    };
    expect(resolveReportRange(state)).toEqual({
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28",
      ready: true,
    });
  });

  it("Total no envía fechas", () => {
    const state: ReportPeriodState = { ...defaultReportPeriod(), kind: "total" };
    expect(resolveReportRange(state)).toEqual({
      dateFrom: null,
      dateTo: null,
      ready: true,
    });
  });

  it("Rango incompleto o invertido no está listo", () => {
    const incomplete: ReportPeriodState = {
      ...defaultReportPeriod(),
      kind: "rango",
      rangeFrom: "2026-08-01",
      rangeTo: "",
    };
    expect(resolveReportRange(incomplete).ready).toBe(false);

    const inverted: ReportPeriodState = {
      ...defaultReportPeriod(),
      kind: "rango",
      rangeFrom: "2026-08-10",
      rangeTo: "2026-08-01",
    };
    expect(resolveReportRange(inverted).ready).toBe(false);
  });
});

describe("reportPeriodLabel", () => {
  it("formatea el día en dd/mm/aaaa", () => {
    const state: ReportPeriodState = {
      ...defaultReportPeriod(),
      kind: "dia",
      day: "2026-08-31",
    };
    expect(reportPeriodLabel(state)).toBe("Día 31/08/2026");
  });

  it("formatea el mes como mm/aaaa", () => {
    const state: ReportPeriodState = {
      ...defaultReportPeriod(),
      kind: "mes",
      month: "2026-08",
    };
    expect(reportPeriodLabel(state)).toBe("Mes 08/2026");
  });
});

describe("reportExportBasename", () => {
  it("normaliza acentos y espacios", () => {
    expect(reportExportBasename("Nómina", "Mes 08/2026")).toBe("reportes-nomina-mes-08-2026");
  });
});

describe("operationalReportTitle", () => {
  it("incluye los informes de inventario", () => {
    expect(operationalReportTitle("consumo")).toBe("Consumo de materiales");
    expect(operationalReportTitle("movimientos")).toBe("Movimientos de inventario");
  });
});
