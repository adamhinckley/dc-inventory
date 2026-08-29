import { describe, expect, expectTypeOf, it } from "vitest";
import {
  tableControlIdBase,
  type TableMeta,
} from "../src/data-table/table-meta";
import { productsListTableFixture } from "./table-meta.fixture";

describe("generated x-table meta shape", () => {
  it("accepts the internal products stub as TableMeta", () => {
    const meta: TableMeta = productsListTableFixture;
    expect(meta.rowId).toBe("id");
    expect(meta.columns.map((column) => column.field)).toEqual([
      "sku",
      "name",
      "memberPrice",
      "currency",
      "inactive",
      "discontinued",
      "webWholesale",
      "onHand",
      "onOrder",
      "allocated",
      "available",
      "createdAt",
    ]);
    expect(meta.search?.param).toBe("q");
    expect(meta.search?.fields).toEqual(["sku", "name"]);
    expect(meta.filters).toEqual([{ param: "inactive", control: "boolean" }]);
    expect(meta.sort.fields).toEqual(["sku", "name", "onHand", "available", "createdAt"]);
  });

  it("types the stub as TableMeta without extra invented filters", () => {
    expectTypeOf(productsListTableFixture).toExtend<TableMeta>();
    expect(productsListTableFixture.filters.map((filter) => filter.param)).not.toContain(
      "category",
    );
  });
});

function staffListMeta(columns: readonly string[]): TableMeta {
  return {
    rowId: "id",
    columns: columns.map((field) => ({ field, label: field })),
    search: { param: "q", fields: ["sku"], placeholder: "Search" },
    filters: [{ param: "inactive", control: "boolean" }],
    sort: { defaultBy: "sku", defaultOrder: "asc", fields: ["sku"] },
  };
}

describe("tableControlIdBase", () => {
  it("is deterministic from meta so SSR and hydration share form-control ids", () => {
    expect(tableControlIdBase(productsListTableFixture)).toBe(
      "dt-q-inactive-sku-id-sku-name-memberPrice-currency-inactive-discontinued-webWholesale-onHand-onOrder-allocated-available-createdAt",
    );
    expect(tableControlIdBase(productsListTableFixture)).toBe(
      tableControlIdBase(productsListTableFixture),
    );
  });

  it("differs when two metas share search, filter, sort, and rowId but not columns", () => {
    expect(tableControlIdBase(staffListMeta(["sku", "name"]))).not.toBe(
      tableControlIdBase(staffListMeta(["sku", "onHand"])),
    );
  });

  it("lets a second Root on the same page pass an explicit prefix", () => {
    expect(tableControlIdBase(productsListTableFixture, "products-picker")).toBe(
      "products-picker",
    );
  });
});
