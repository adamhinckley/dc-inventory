import { listInternalProductsTable } from "@dc-inventory/api-client-internal";
import { describe, expect, it } from "vitest";
import {
  inventoryListInitialParams,
  inventoryListQueryParams,
  inventoryListTable,
} from "./inventory-list-table";
import { listParamsFromSearchParams } from "./table-url-params";

describe("inventoryListTable", () => {
  it("is a snapshot view of the staff products list, not a second catalog", () => {
    expect(inventoryListTable.columns.map((column) => column.field)).toEqual([
      "sku",
      "name",
      "supplierName",
      "onHand",
      "onOrder",
      "allocated",
      "committed",
      "available",
      "availableToSell",
      "sellState",
    ]);
    expect(inventoryListTable.columns.map((column) => column.field)).not.toEqual(
      expect.arrayContaining([
        "memberPrice",
        "currency",
        "inactive",
        "discontinued",
        "webWholesale",
        "caseQty",
        "createdAt",
      ]),
    );
    expect(inventoryListTable.search).toEqual(listInternalProductsTable.search);
    expect(inventoryListTable.sort.fields).toEqual([
      "sku",
      "name",
      "onHand",
      "onOrder",
      "allocated",
      "available",
      "committed",
      "availableToSell",
      "sellState",
    ]);
    expect(inventoryListTable.sort.fields.every((field) =>
      listInternalProductsTable.sort.fields.includes(field),
    )).toBe(true);
  });

  it("exposes every staff product list filter", () => {
    expect(inventoryListTable.filters).toEqual(listInternalProductsTable.filters);
    expect(inventoryListTable.filters?.map((filter) => filter.param)).toEqual([
      "inactive",
      "hideZeroInventory",
      "category",
      "supplierId",
      "excludeSupplierId",
      "sellState",
    ]);
  });

  it("keeps hide-empty off unless the URL opts in", () => {
    expect(inventoryListInitialParams({}, listParamsFromSearchParams)).toEqual({});
    expect(inventoryListQueryParams({})).toEqual({});
    expect(
      inventoryListInitialParams(
        { hideZeroInventory: "true" },
        listParamsFromSearchParams,
      ),
    ).toEqual({
      hideZeroInventory: true,
    });
    expect(inventoryListQueryParams({ hideZeroInventory: true })).toEqual({
      hideZeroInventory: true,
    });
  });
});
