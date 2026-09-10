import { listInternalUncoveredSkusTable } from "@dc-inventory/api-client-internal";
import { describe, expect, it } from "vitest";
import { uncoveredListTable } from "./uncovered-list-table";

describe("uncoveredListTable", () => {
  it("extends the generated x-table with suggested qty", () => {
    expect(uncoveredListTable.rowId).toBe(listInternalUncoveredSkusTable.rowId);
    expect(uncoveredListTable.columns.map((column) => column.field)).toEqual([
      ...listInternalUncoveredSkusTable.columns.map((column) => column.field),
      "suggestedQty",
    ]);
  });

  it("remaps staff pre-order column labels on the gap and committed fields", () => {
    const labels = Object.fromEntries(
      uncoveredListTable.columns.map((column) => [column.field, column.label]),
    );
    expect(labels.uncovered).toBe("To Order");
    expect(labels.committed).toBe("Pre-sold");
    expect(labels.onHand).toBe("On hand");
  });
});
