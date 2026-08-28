import { describe, expect, it } from "vitest";
import { draftPurchaseOrdersListTable } from "./draft-purchase-orders-list-table";

describe("draftPurchaseOrdersListTable", () => {
  it("matches purchase order list x-table columns and sort fields", () => {
    expect(draftPurchaseOrdersListTable.rowId).toBe("id");
    expect(draftPurchaseOrdersListTable.columns.map((column) => column.field)).toEqual([
      "documentNumber",
      "status",
      "supplierId",
    ]);
    expect(draftPurchaseOrdersListTable.sort.fields).toEqual([
      "documentNumber",
      "status",
    ]);
  });
});
