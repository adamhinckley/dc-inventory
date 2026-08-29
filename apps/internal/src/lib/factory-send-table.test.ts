import { describe, expect, it } from "vitest";
import {
  factorySendRowId,
  factorySendTableColumns,
  formatFactorySendCell,
} from "./factory-send-table";

describe("factorySendTableColumns", () => {
  it("assigns mill column widths", () => {
    const columns = factorySendTableColumns([
      { key: "ship_date", header: "ship_date" },
      { key: "mat_num", header: "mat_num" },
      { key: "tot_cartons", header: "tot_cartons" },
    ]);
    expect(columns.map((column) => column.width)).toEqual([110, 140, 110]);
  });
});

describe("formatFactorySendCell", () => {
  it("leaves blank factory-send cells empty", () => {
    expect(formatFactorySendCell("")).toBe("");
    expect(formatFactorySendCell(undefined)).toBe("");
  });
});

describe("factorySendRowId", () => {
  it("falls back to line when mat_num is missing", () => {
    expect(factorySendRowId({ quan: 5 })).toBe("line");
  });

  it("uses different ids for different mill SKUs", () => {
    expect(factorySendRowId({ mat_num: "DC7818LV" })).not.toBe(
      factorySendRowId({ mat_num: "DC7819LV" }),
    );
  });
});
