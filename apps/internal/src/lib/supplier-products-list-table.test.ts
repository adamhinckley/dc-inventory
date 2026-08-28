import { describe, expect, expectTypeOf, it } from "vitest";
import type { TableMeta } from "@dc-inventory/ui-internal";
import { supplierProductsListTable } from "./supplier-products-list-table";

describe("supplierProductsListTable", () => {
  it("matches the GET /internal/suppliers/{id}/products x-table contract", () => {
    expectTypeOf(supplierProductsListTable).toExtend<TableMeta>();
    expect(supplierProductsListTable.rowId).toBe("id");
    expect(supplierProductsListTable.filters).toEqual([]);
    expect(supplierProductsListTable.columns.map((column) => column.field)).toContain(
      "qty.onHand",
    );
  });
});
