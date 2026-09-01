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

  it("keeps hide-empty off unless the URL opts in", () => {
    expect(inventoryListTable.filters).toEqual([
      { param: "hideZeroInventory", control: "boolean" },
    ]);
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
