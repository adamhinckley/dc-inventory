import { describe, expect, expectTypeOf, it } from "vitest";
import type { TableMeta } from "@dc-inventory/ui-internal";
import { purchaseOrdersListTable } from "./purchase-orders-list-table";

describe("purchaseOrdersListTable", () => {
  it("matches the GET /internal/purchase-orders x-table contract", () => {
    expectTypeOf(purchaseOrdersListTable).toExtend<TableMeta>();
    expect(purchaseOrdersListTable.rowId).toBe("id");
    expect("search" in purchaseOrdersListTable).toBe(false);
    expect(purchaseOrdersListTable.filters).toEqual([]);
    expect(purchaseOrdersListTable.columns.map((column) => column.field)).toEqual([
      "documentNumber",
      "status",
      "supplierName",
    ]);
  });
});
