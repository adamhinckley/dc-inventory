import { describe, expect, expectTypeOf, it } from "vitest";
import { productsListTable } from "../src/fixtures/products-list-table";
import type { TableMeta } from "../src/data-table/table-meta";

describe("generated x-table meta shape", () => {
  it("accepts the internal products stub as TableMeta", () => {
    const meta: TableMeta = productsListTable;
    expect(meta.rowId).toBe("id");
    expect(meta.columns.map((column) => column.field)).toEqual([
      "sku",
      "name",
      "onHand",
      "onOrder",
      "allocated",
      "available",
    ]);
    expect(meta.search?.param).toBe("q");
    expect(meta.search?.fields).toEqual(["sku", "name"]);
    expect(meta.filters).toEqual([{ param: "status", control: "select" }]);
    expect(meta.sort.fields).toEqual(["sku", "name", "available", "createdAt"]);
  });

  it("types the stub as TableMeta without extra invented filters", () => {
    expectTypeOf(productsListTable).toExtend<TableMeta>();
    expect(productsListTable.filters.map((filter) => filter.param)).not.toContain(
      "category",
    );
  });
});
