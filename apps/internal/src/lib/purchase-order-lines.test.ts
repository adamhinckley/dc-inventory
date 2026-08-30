import { describe, expect, it } from "vitest";
import {
  appendPurchaseOrderLine,
  coalescePurchaseOrderLines,
  purchaseOrderLineRowKey,
  purchaseOrderLineWritesEqual,
  purchaseOrderLinesSavedForConfirm,
  purchaseOrderWriteLines,
  removePurchaseOrderLinesByRowKeys,
} from "./purchase-order-lines";
import type { PurchaseOrderLineDraft } from "./purchase-order-types";

const dem00003 = (id: string, qty: number): PurchaseOrderLineDraft => ({
  id,
  sku: "DEM-00003",
  name: "Connector metallic plug",
  qty,
});

/** Exact PATCH body captured from the draft PO workspace. */
const capturedDuplicateLines: PurchaseOrderLineDraft[] = [
  { sku: "DEM-00003", name: "Connector metallic plug", qty: 1 },
  { sku: "DEM-00003", name: "Connector metallic plug", qty: 1 },
  { sku: "DEM-00004", name: "Hook taper pin", qty: 1 },
  { sku: "DEM-00003", name: "Connector metallic plug", qty: 1 },
  { sku: "DEM-00004", name: "Hook taper pin", qty: 1 },
];

describe("purchase order line draft helpers", () => {
  it("gives distinct React keys when two lines share DEM-00003", () => {
    const keys = [dem00003("line-a", 2), dem00003("line-b", 4)].map((line, index) =>
      purchaseOrderLineRowKey(line, index),
    );
    expect(keys).toEqual(["line-a", "line-b"]);
    expect(new Set(keys).size).toBe(2);
  });

  it("falls back to sku plus index when a line has no id", () => {
    expect(
      purchaseOrderLineRowKey({ sku: "DEM-00003", name: "Connector metallic plug", qty: 1 }, 1),
    ).toBe("DEM-00003:1");
  });

  it("adds qty onto an existing DEM-00003 row instead of appending a second row", () => {
    const lines = [dem00003("line-a", 2)];
    expect(
      appendPurchaseOrderLine(lines, {
        sku: "DEM-00003",
        name: "Connector metallic plug",
        qty: 9,
      }),
    ).toEqual([{ id: "line-a", sku: "DEM-00003", name: "Connector metallic plug", qty: 11 }]);
  });

  it("appends a new SKU", () => {
    const lines = [dem00003("line-a", 2)];
    const added: PurchaseOrderLineDraft = {
      id: "line-c",
      sku: "DEM-00001",
      name: "Grade 5 hex cap",
      qty: 1,
    };
    expect(appendPurchaseOrderLine(lines, added)).toEqual([...lines, added]);
  });

  it("coalesces the captured PATCH body into one row per SKU", () => {
    expect(purchaseOrderWriteLines(capturedDuplicateLines)).toEqual([
      { sku: "DEM-00003", name: "Connector metallic plug", qty: 3 },
      { sku: "DEM-00004", name: "Hook taper pin", qty: 2 },
    ]);
  });

  it("collapses duplicate SKU rows loaded from the server", () => {
    expect(
      coalescePurchaseOrderLines([
        dem00003("line-a", 1),
        { id: "line-b", sku: "DEM-00004", name: "Hook taper pin", qty: 1 },
        dem00003("line-c", 2),
      ]),
    ).toEqual([
      { id: "line-a", sku: "DEM-00003", name: "Connector metallic plug", qty: 3 },
      { id: "line-b", sku: "DEM-00004", name: "Hook taper pin", qty: 1 },
    ]);
  });

  it("treats duplicate qty-1 rows as equal to the coalesced write payload", () => {
    expect(
      purchaseOrderLineWritesEqual(capturedDuplicateLines, [
        { sku: "DEM-00003", name: "Connector metallic plug", qty: 3 },
        { sku: "DEM-00004", name: "Hook taper pin", qty: 2 },
      ]),
    ).toBe(true);
  });

  it("removes selected line keys and refuses to empty the draft", () => {
    const lines = [dem00003("line-a", 2), dem00003("line-b", 4)];
    expect(
      removePurchaseOrderLinesByRowKeys(lines, new Set(["line-a"])),
    ).toEqual([dem00003("line-b", 4)]);
    expect(
      removePurchaseOrderLinesByRowKeys(lines, new Set(["line-a", "line-b"])),
    ).toBeNull();
  });

  it("does not confirm when the last persist failed", () => {
    expect(
      purchaseOrderLinesSavedForConfirm(capturedDuplicateLines, capturedDuplicateLines, false),
    ).toBe(false);
  });

  it("confirms only after a successful persist of the coalesced lines", () => {
    const saved = [
      { sku: "DEM-00003", name: "Connector metallic plug", qty: 3 },
      { sku: "DEM-00004", name: "Hook taper pin", qty: 2 },
    ];
    expect(purchaseOrderLinesSavedForConfirm(capturedDuplicateLines, saved, true)).toBe(true);
    expect(
      purchaseOrderLinesSavedForConfirm(
        [...capturedDuplicateLines, { sku: "DEM-00001", name: "Grade 5 hex cap", qty: 1 }],
        saved,
        true,
      ),
    ).toBe(false);
  });
});
