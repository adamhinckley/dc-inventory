import { describe, expect, it } from "vitest";
import {
  appliedTableFilterValue,
  tableFilterFields,
} from "../src/data-table/table-filter-bar";
import type { TableMeta } from "../src/data-table/table-meta";

const meta: TableMeta = {
  rowId: "id",
  columns: [{ field: "sku", label: "SKU" }],
  search: { param: "q", fields: ["sku"], placeholder: "Search SKU or name" },
  filters: [
    { param: "inactive", control: "boolean" },
    { param: "category", control: "multiselect" },
    { param: "createdAt", control: "dateRange", rangePair: "createdTo" },
  ],
};

describe("tableFilterFields", () => {
  it("maps declared boolean and select filters and skips date ranges", () => {
    const fields = tableFilterFields(
      meta,
      { category: [{ value: "Hardware", label: "Hardware" }] },
      { inactive: "Inactive", category: "Category" },
    );
    expect(Object.keys(fields)).toEqual(["inactive", "category"]);
    expect(fields.inactive).toEqual({
      label: "Inactive",
      filter: { kind: "boolean" },
    });
    expect(fields.category).toEqual({
      label: "Category",
      filter: {
        kind: "multiselect",
        options: [{ value: "Hardware", label: "Hardware" }],
      },
    });
  });
});

describe("appliedTableFilterValue", () => {
  it("drops empty chip values so they never become query params", () => {
    expect(appliedTableFilterValue(null)).toBeUndefined();
    expect(appliedTableFilterValue("")).toBeUndefined();
    expect(appliedTableFilterValue(true)).toBe(true);
    expect(appliedTableFilterValue(false)).toBe(false);
    expect(appliedTableFilterValue("Hardware")).toBe("Hardware");
    expect(appliedTableFilterValue(["Hardware", "Textiles"])).toEqual([
      "Hardware",
      "Textiles",
    ]);
    expect(appliedTableFilterValue([])).toBeUndefined();
  });
});
