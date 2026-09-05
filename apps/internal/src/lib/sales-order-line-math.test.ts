import { describe, expect, it } from "vitest";
import {
  salesOrderCancelDisabled,
  salesOrderCatalogLookupPending,
  salesOrderConfirmDisabled,
  salesOrderLinesResolved,
  salesOrderLineWritesEqual,
  salesOrderShipDisabled,
  salesOrderWriteLines,
} from "./sales-order-line-math";
import type { SalesOrderLineDraft } from "./sales-order-types";

describe("sales order line math", () => {
  const lineA: SalesOrderLineDraft = {
    rowKey: "sku-a",
    productId: "11111111-1111-4111-8111-111111111111",
    sku: "SKU-A",
    name: "Product A",
    qty: 2,
    unitPriceCents: 100,
    currency: "USD",
  };
  const lineB: SalesOrderLineDraft = {
    ...lineA,
    rowKey: "sku-b",
    productId: "22222222-2222-4222-8222-222222222222",
    sku: "SKU-B",
    name: "Product B",
    qty: 1,
  };

  it("builds replace-lines payloads from draft rows", () => {
    expect(salesOrderWriteLines([lineA, lineB])).toEqual([
      { productId: lineA.productId, qty: 2 },
      { productId: lineB.productId, qty: 1 },
    ]);
  });

  it("detects dirty line qty changes by sku", () => {
    expect(salesOrderLineWritesEqual([lineA], [lineA])).toBe(true);
    expect(
      salesOrderLineWritesEqual([lineA], [{ ...lineA, qty: 3 }]),
    ).toBe(false);
  });

  it("requires every line to have a product id before save or confirm", () => {
    expect(salesOrderLinesResolved([lineA])).toBe(true);
    expect(salesOrderLinesResolved([{ ...lineA, productId: "" }])).toBe(false);
    expect(
      salesOrderCatalogLookupPending([lineA], new Map([["SKU-A", "loading"]])),
    ).toBe(true);
  });

  it("blocks confirm while autosave, unresolved lines, or cancel is pending", () => {
    expect(
      salesOrderConfirmDisabled({
        status: "draft",
        lineCount: 1,
        shipToId: "ship-to",
        autosavePending: false,
        linesDirty: false,
        linesUnresolved: false,
        catalogLookupPending: false,
        confirmPending: false,
        cancelPending: false,
      }),
    ).toBe(false);
    expect(
      salesOrderConfirmDisabled({
        status: "draft",
        lineCount: 1,
        shipToId: "ship-to",
        autosavePending: false,
        linesDirty: false,
        linesUnresolved: true,
        catalogLookupPending: false,
        confirmPending: false,
        cancelPending: false,
      }),
    ).toBe(true);
    expect(
      salesOrderConfirmDisabled({
        status: "draft",
        lineCount: 1,
        shipToId: "ship-to",
        autosavePending: false,
        linesDirty: false,
        linesUnresolved: false,
        catalogLookupPending: false,
        confirmPending: false,
        cancelPending: true,
      }),
    ).toBe(true);
  });

  it("blocks cancel while confirm or ship is pending", () => {
    expect(
      salesOrderCancelDisabled({
        status: "draft",
        autosavePending: false,
        cancelPending: false,
        confirmPending: true,
        shipPending: false,
      }),
    ).toBe(true);
    expect(
      salesOrderCancelDisabled({
        status: "confirmed",
        autosavePending: false,
        cancelPending: false,
        confirmPending: false,
        shipPending: true,
      }),
    ).toBe(true);
  });

  it("blocks ship while cancel is pending", () => {
    expect(
      salesOrderShipDisabled({
        status: "confirmed",
        shipPending: false,
        cancelPending: true,
      }),
    ).toBe(true);
  });
});
