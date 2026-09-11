import { listInternalPreOrderSkusTable } from "@dc-inventory/api-client-internal";
import { describe, expect, it } from "vitest";
import { preOrderListTable } from "./uncovered-list-table";

describe("preOrderListTable", () => {
  it("extends the generated x-table with suggested qty", () => {
    expect(preOrderListTable.rowId).toBe(listInternalPreOrderSkusTable.rowId);
    expect(preOrderListTable.columns.map((column) => column.field)).toEqual([
      ...listInternalPreOrderSkusTable.columns.map((column) => column.field),
      "suggestedQty",
    ]);
  });

  it("remaps staff pre-order column labels on the gap and committed fields", () => {
    const labels = Object.fromEntries(
      preOrderListTable.columns.map((column) => [column.field, column.label]),
    );
    expect(labels.toOrder).toBe("To Order");
    expect(labels.committed).toBe("Pre-sold");
    expect(labels.onHand).toBe("On hand");
  });
});
