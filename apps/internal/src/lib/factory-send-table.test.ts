import { describe, expect, it } from "vitest";
import {
  factorySendRowId,
  factorySendTableColumns,
  formatFactorySendCell,
} from "./factory-send-table";

describe("factorySendTableColumns", () => {
  it("keeps mill XLS headers and order", () => {
    const columns = factorySendTableColumns([
      { key: "ship_date", header: "ship_date" },
      { key: "mat_num", header: "mat_num" },
      { key: "tot_cartons", header: "tot_cartons" },
    ]);
    expect(columns.map((column) => column.id)).toEqual([
      "ship_date",
      "mat_num",
      "tot_cartons",
    ]);
    expect(columns.map((column) => column.label)).toEqual([
      "ship_date",
      "mat_num",
      "tot_cartons",
    ]);
  });
});

describe("formatFactorySendCell", () => {
  it("leaves blank factory-send cells empty", () => {
    expect(formatFactorySendCell("")).toBe("");
    expect(formatFactorySendCell(292)).toBe("292");
    expect(formatFactorySendCell(0.65)).toBe("0.65");
  });
});

describe("factorySendRowId", () => {
  it("falls back to line when mat_num is missing", () => {
    expect(factorySendRowId({ quan: 5 })).toBe("line");
  });

  it("uses different ids for different mill SKUs", () => {
    const first = factorySendRowId({ mat_num: "DC7818LV" });
    const second = factorySendRowId({ mat_num: "DC7819LV" });
    expect(first).not.toBe(second);
    expect(first).toBe("DC7818LV");
    expect(second).toBe("DC7819LV");
  });
});
