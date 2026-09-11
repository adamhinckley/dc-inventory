import { describe, expect, it } from "vitest";
import {
  appendPurchaseOrderLine,
  casesForDraftPoQty,
  coalescePurchaseOrderLines,
  draftLineFromVendorProduct,
  filterReceiveLines,
  purchaseOrderHasReceivedQty,
  purchaseOrderLineRemainingQty,
  purchaseOrderLineRowKey,
  purchaseOrderLineWritesEqual,
  purchaseOrderLinesSavedForConfirm,
  purchaseOrderRemainingQty,
  purchaseOrderWasShortReceived,
  purchaseOrderWriteLines,
  receiveLinesPayload,
  receivingCanCancelRemaining,
  receivingCanReceive,
  receivingShowShortPanel,
  removePurchaseOrderLinesByRowKeys,
  suggestedDraftPoQty,
} from "./purchase-order-line-math";
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

describe("purchase order draft line math", () => {
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

describe("suggestedDraftPoQty", () => {
  it("ceils need to the next master pack (584 units, 100 per case → 600)", () => {
    expect(suggestedDraftPoQty(584, 100)).toBe(600);
  });

  it("starts at qty 1 when there is no need", () => {
    expect(suggestedDraftPoQty(0, 12)).toBe(1);
  });

  it("uses raw need when case qty is missing", () => {
    expect(suggestedDraftPoQty(40, null)).toBe(40);
  });
});

describe("casesForDraftPoQty", () => {
  it("shows six cases for 600 units at 100 per case", () => {
    expect(casesForDraftPoQty(600, 100)).toBe(6);
  });

  it("leaves cases blank without case qty", () => {
    expect(casesForDraftPoQty(40, null)).toBeNull();
  });
});

describe("draftLineFromVendorProduct", () => {
  it("covers toOrder need rounded up to a master pack", () => {
    const line = draftLineFromVendorProduct({
      sku: "DC7818LV",
      catalogName: 'Baby Rose Bush X 7 12" - Lavender',
      caseQty: 100,
      qty: { toOrder: 584 },
    });
    expect(line.qty).toBe(600);

    const second = draftLineFromVendorProduct({
      sku: "DC7819LV",
      catalogName: "Different rose",
    });
    expect(second.qty).toBe(1);
    expect(second.id).not.toBe(line.id);
  });
});

describe("purchaseOrderLineRemainingQty", () => {
  it("returns ordered minus received", () => {
    expect(purchaseOrderLineRemainingQty({ qty: 10, receivedQty: 3 })).toBe(7);
  });

  it("returns zero when fully received", () => {
    expect(purchaseOrderLineRemainingQty({ qty: 4, receivedQty: 4 })).toBe(0);
  });

  it("returns full qty when nothing received yet", () => {
    expect(purchaseOrderLineRemainingQty({ qty: 12, receivedQty: 0 })).toBe(12);
  });
});

describe("purchaseOrderRemainingQty", () => {
  it("sums qty minus receivedQty across lines", () => {
    expect(
      purchaseOrderRemainingQty([
        { qty: 10, receivedQty: 3 },
        { qty: 5, receivedQty: 0 },
      ]),
    ).toBe(12);
  });

  it("returns zero for fully received lines", () => {
    expect(
      purchaseOrderRemainingQty([
        { qty: 4, receivedQty: 4 },
        { qty: 2, receivedQty: 2 },
      ]),
    ).toBe(0);
  });
});

describe("receiving line filters and gates", () => {
  const rows = [
    {
      id: "line-a",
      sku: "DEM-00003",
      name: "Connector",
      qty: 10,
      receivedQty: 3,
      remaining: 7,
    },
    {
      id: "line-b",
      sku: "DEM-00004",
      name: "Hook",
      qty: 5,
      receivedQty: 5,
      remaining: 0,
    },
  ];

  it("filters by remaining-only and find needle", () => {
    expect(filterReceiveLines(rows, "", true)).toEqual([rows[0]]);
    expect(filterReceiveLines(rows, "hook", false)).toEqual([rows[1]]);
    expect(filterReceiveLines(rows, "", false)).toEqual(rows);
  });

  it("builds receive payload from positive quantities only", () => {
    expect(
      receiveLinesPayload(rows, { "line-a": 4, "line-b": 0 }),
    ).toEqual([{ lineId: "line-a", quantity: 4 }]);
  });

  it("gates receive and cancel-remaining by status and quantities", () => {
    const lines = rows.map(({ qty, receivedQty }) => ({ qty, receivedQty }));
    expect(receivingCanReceive("confirmed", 7)).toBe(true);
    expect(receivingCanReceive("draft", 7)).toBe(false);
    expect(receivingCanCancelRemaining("confirmed", 7, lines)).toBe(true);
    expect(receivingCanCancelRemaining("confirmed", 7, [{ qty: 5, receivedQty: 0 }])).toBe(
      false,
    );
    expect(receivingShowShortPanel("received", [{ qty: 5, receivedQty: 3 }])).toBe(true);
    expect(receivingShowShortPanel("received", [{ qty: 5, receivedQty: 5 }])).toBe(false);
  });

  it("detects short-received and partial receipts", () => {
    expect(purchaseOrderWasShortReceived([{ qty: 5, receivedQty: 3 }])).toBe(true);
    expect(purchaseOrderHasReceivedQty([{ qty: 5, receivedQty: 0 }])).toBe(false);
  });
});
