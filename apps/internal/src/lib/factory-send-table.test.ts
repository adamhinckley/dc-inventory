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
  it("uses mill SKU as the row id", () => {
    expect(factorySendRowId({ mat_num: "DC7818LV" })).toBe("DC7818LV");
  });
});
