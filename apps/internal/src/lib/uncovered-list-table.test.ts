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
});
