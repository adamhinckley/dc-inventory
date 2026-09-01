import { listInternalProductsTable } from "@dc-inventory/api-client-internal";
import { describe, expect, it } from "vitest";
import {
  inventoryListInitialParams,
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

  it("defaults hideZeroInventory on unless the URL opts out", () => {
    expect(inventoryListTable.filters).toEqual([
      { param: "hideZeroInventory", control: "boolean" },
    ]);
    expect(inventoryListInitialParams({}, listParamsFromSearchParams)).toEqual({
      hideZeroInventory: true,
    });
    expect(
      inventoryListInitialParams(
        { hideZeroInventory: "false" },
        listParamsFromSearchParams,
      ),
    ).toEqual({
      hideZeroInventory: false,
    });
  });
});
