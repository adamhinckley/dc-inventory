import { describe, expect, expectTypeOf, it } from "vitest";
import type { TableMeta } from "@dc-inventory/ui-internal";
import { suppliersListTable } from "./suppliers-list-table";

describe("suppliersListTable", () => {
  it("matches the GET /internal/suppliers x-table contract", () => {
    expectTypeOf(suppliersListTable).toExtend<TableMeta>();
    expect(suppliersListTable.rowId).toBe("id");
    expect(suppliersListTable.search?.param).toBe("q");
    expect(suppliersListTable.filters).toEqual([]);
    expect(suppliersListTable.columns.map((column) => column.field)).toEqual([
      "vendorNumber",
      "name",
    ]);
  });
});
