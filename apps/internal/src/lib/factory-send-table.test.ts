import { describe, expect, it } from "vitest";
import {
  FACTORY_SEND_ENTER_CASE_QTY_HINT,
  FACTORY_SEND_NO_CASE_QTY_LABEL,
  factorySendBlockedSkus,
  factorySendRowBlocksCartons,
  factorySendRowClassName,
  factorySendRowId,
  factorySendTableColumns,
  firstBlockedSku,
  formatFactorySendCell,
  missingCaseQtyRowElementId,
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

describe("factorySendRowBlocksCartons", () => {
  it("marks the mill row that is missing case qty", () => {
    expect(
      factorySendRowBlocksCartons({ mat_num: "DCS7804", blocks_tot_cartons: true }),
    ).toBe(true);
    expect(
      factorySendRowBlocksCartons({ mat_num: "DC7818CR", blocks_tot_cartons: false }),
    ).toBe(false);
    expect(FACTORY_SEND_NO_CASE_QTY_LABEL).toBe("No case qty");
    expect(FACTORY_SEND_ENTER_CASE_QTY_HINT).toBe(
      "Enter case quantity so tot_cartons can be calculated",
    );
    expect(factorySendRowClassName({ blocks_tot_cartons: true })).toBe("bg-warning/25");
    expect(factorySendBlockedSkus([{ mat_num: "DCS7804", blocks_tot_cartons: true }])).toEqual(
      new Set(["DCS7804"]),
    );
  });
});

describe("missing case qty row target", () => {
  it("picks the first non-empty blocked SKU and names its row id", () => {
    expect(
      firstBlockedSku([
        { mat_num: "DC7818CR", blocks_tot_cartons: false },
        { mat_num: "", blocks_tot_cartons: true },
        { mat_num: "DCB7925BK", blocks_tot_cartons: true },
      ]),
    ).toBe("DCB7925BK");
    expect(missingCaseQtyRowElementId("DCB7925BK")).toBe(
      "po-line-missing-case-qty-DCB7925BK",
    );
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
