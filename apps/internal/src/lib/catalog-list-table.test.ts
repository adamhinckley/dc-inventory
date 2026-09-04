import { describe, expect, it } from "vitest";
import { catalogListTable } from "./catalog-list-table";

describe("catalogListTable", () => {
  it("omits hideZeroInventory from catalog filter chrome", () => {
    expect(catalogListTable.filters?.map((filter) => filter.param)).toEqual([
      "inactive",
    ]);
  });

  it("shows merchandising prices, not inventory qty columns", () => {
    expect(catalogListTable.columns.map((column) => column.field)).toEqual([
      "sku",
      "name",
      "listPrice",
      "lastPoCostCents",
      "inactive",
      "discontinued",
      "webWholesale",
    ]);
    expect(catalogListTable.sort?.fields).toEqual(["sku", "name"]);
  });
});
