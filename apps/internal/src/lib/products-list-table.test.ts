import { describe, expect, expectTypeOf, it } from "vitest";
import type { TableMeta } from "@dc-inventory/ui-internal";
import { productsListTable } from "./products-list-table";

describe("productsListTable", () => {
  it("matches the GET /internal/products x-table contract", () => {
    expectTypeOf(productsListTable).toExtend<TableMeta>();
    expect(productsListTable.rowId).toBe("id");
    expect(productsListTable.search?.param).toBe("q");
    expect(productsListTable.filters).toEqual([
      { param: "inactive", control: "boolean" },
    ]);
    expect(productsListTable.filters.map((filter) => filter.param)).not.toContain(
      "status",
    );
    expect(productsListTable.filters.map((filter) => filter.param)).not.toContain(
      "category",
    );
    expect(productsListTable.columns.map((column) => column.field)).toEqual([
      "sku",
      "name",
      "memberPrice",
      "currency",
      "inactive",
      "discontinued",
      "webWholesale",
      "onHand",
      "onOrder",
      "allocated",
      "available",
      "createdAt",
    ]);
    expect(productsListTable.sort.fields).toEqual([
      "sku",
      "name",
      "onHand",
      "available",
      "createdAt",
    ]);
  });
});
