import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, monthEndIso, monthStartIso, todayIso, currentMonthYm, clampIsoToMonth } from "@/lib/format-date";

describe("format-date", () => {
  it("formats an ISO date as dd/mm/aaaa", () => {
    expect(formatDate("2026-07-16")).toBe("16/07/2026");
  });

  it("formats a datetime keeping the date part as dd/mm/aaaa", () => {
    expect(formatDate("2026-01-05 09:30:00")).toBe("05/01/2026");
  });

  it("returns the fallback for empty or invalid values", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("")).toBe("—");
    expect(formatDate("not-a-date", "N/D")).toBe("N/D");
  });

  it("formats a datetime as dd/mm/aaaa HH:MM", () => {
    expect(formatDateTime("2026-07-16 14:05:00")).toBe("16/07/2026 14:05");
  });

  it("todayIso returns a YYYY-MM-DD string", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("currentMonthYm returns YYYY-MM of todayIso", () => {
    expect(currentMonthYm()).toBe(todayIso().slice(0, 7));
  });

  it("returns the first and last day of the month as ISO", () => {
    expect(monthStartIso("2026-02-17")).toBe("2026-02-01");
    expect(monthEndIso("2026-02-17")).toBe("2026-02-28");
    expect(monthEndIso("2024-02-10")).toBe("2024-02-29");
    expect(monthEndIso("2026-08-01")).toBe("2026-08-31");
  });

  it("clamps a date into the given month", () => {
    expect(clampIsoToMonth("2026-07-31", "2026-08")).toBe("2026-08-01");
    expect(clampIsoToMonth("2026-09-01", "2026-08")).toBe("2026-08-31");
    expect(clampIsoToMonth("2026-08-15", "2026-08")).toBe("2026-08-15");
  });
});
