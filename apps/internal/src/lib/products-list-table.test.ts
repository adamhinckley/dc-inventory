import { describe, expect, expectTypeOf, it } from "vitest";
import type { TableMeta } from "@dc-inventory/ui-internal";
import {
  productStatusFilterOptions,
  productsListTable,
} from "./products-list-table";

describe("productsListTable", () => {
  it("matches the GET /internal/products x-table contract", () => {
    expectTypeOf(productsListTable).toExtend<TableMeta>();
    expect(productsListTable.rowId).toBe("id");
    expect(productsListTable.search?.param).toBe("q");
    expect(productsListTable.filters.map((filter) => filter.param)).toEqual([
      "status",
    ]);
    expect(productsListTable.filters.map((filter) => filter.param)).not.toContain(
      "category",
    );
    expect(productStatusFilterOptions.map((option) => option.value)).toEqual([
      "active",
      "inactive",
    ]);
  });
});
