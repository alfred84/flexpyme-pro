import { describe, expect, it } from "vitest";
import { resolveFormatSelection, formatsForItemSelect } from "@/lib/formats";

describe("resolveFormatSelection", () => {
  const formats = [
    { id: 1, label: "Sin formato" },
    { id: 2, label: "5x7" },
  ];

  it("keeps a valid current format", () => {
    expect(resolveFormatSelection(formats, 2)).toBe(2);
  });

  it("defaults to Sin formato when nothing is selected", () => {
    expect(resolveFormatSelection(formats, null)).toBe(1);
    expect(resolveFormatSelection(formats, undefined)).toBe(1);
  });

  it("uses Sin formato when the current id is not in the list", () => {
    expect(resolveFormatSelection(formats, 99)).toBe(1);
  });

  it("does not fall back to a print size when Sin formato is missing", () => {
    expect(resolveFormatSelection([{ id: 2, label: "10x12" }], null)).toBeNull();
  });
});

describe("formatsForItemSelect", () => {
  it("puts Sin formato first and keeps active print sizes", () => {
    const ordered = formatsForItemSelect([
      { id: 2, label: "10x12", isActive: true },
      { id: 1, label: "Sin formato", isActive: true },
      { id: 3, label: "5x7", isActive: false },
    ]);
    expect(ordered.map((f) => f.label)).toEqual(["Sin formato", "10x12"]);
  });
});
