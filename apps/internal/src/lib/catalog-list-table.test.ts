import { listInternalProductsTable } from "@dc-inventory/api-client-internal";
import { describe, expect, it } from "vitest";
import { catalogListTable } from "./catalog-list-table";

describe("catalogListTable", () => {
  it("omits hideZeroInventory from catalog filter chrome", () => {
    expect(catalogListTable.filters?.map((filter) => filter.param)).toEqual([
      "inactive",
    ]);
    expect(listInternalProductsTable.filters?.map((filter) => filter.param)).toContain(
      "hideZeroInventory",
    );
  });
});
