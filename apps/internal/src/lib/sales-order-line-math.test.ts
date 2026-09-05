import { describe, expect, it } from "vitest";
import {
  salesOrderCancelDisabled,
  salesOrderConfirmDisabled,
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

  it("blocks confirm while autosave is pending or lines are dirty", () => {
    expect(
      salesOrderConfirmDisabled({
        status: "draft",
        lineCount: 1,
        shipToId: "ship-to",
        autosavePending: false,
        linesDirty: false,
        confirmPending: false,
      }),
    ).toBe(false);
    expect(
      salesOrderConfirmDisabled({
        status: "draft",
        lineCount: 1,
        shipToId: "ship-to",
        autosavePending: true,
        linesDirty: false,
        confirmPending: false,
      }),
    ).toBe(true);
    expect(
      salesOrderConfirmDisabled({
        status: "draft",
        lineCount: 1,
        shipToId: "",
        autosavePending: false,
        linesDirty: false,
        confirmPending: false,
      }),
    ).toBe(true);
  });

  it("allows cancel on draft and confirmed only", () => {
    expect(
      salesOrderCancelDisabled({
        status: "draft",
        autosavePending: false,
        cancelPending: false,
      }),
    ).toBe(false);
    expect(
      salesOrderCancelDisabled({
        status: "confirmed",
        autosavePending: false,
        cancelPending: false,
      }),
    ).toBe(false);
    expect(
      salesOrderCancelDisabled({
        status: "shipped",
        autosavePending: false,
        cancelPending: false,
      }),
    ).toBe(true);
  });

  it("allows ship only on confirmed orders", () => {
    expect(
      salesOrderShipDisabled({
        status: "confirmed",
        shipPending: false,
      }),
    ).toBe(false);
    expect(
      salesOrderShipDisabled({
        status: "draft",
        shipPending: false,
      }),
    ).toBe(true);
  });
});
