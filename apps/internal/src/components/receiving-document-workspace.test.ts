import { describe, expect, it } from "vitest";
import {
  filterReceiveLines,
  receiveLinesPayload,
  receivingCanCancelRemaining,
  receivingCanReceive,
  receivingShowShortPanel,
} from "../lib/purchase-order-line-math";

describe("ReceivingDocumentWorkspace interface", () => {
  const rows = [
    {
      id: "line-a",
      sku: "DEM-00003",
      name: "Connector",
      qty: 10,
      receivedQty: 2,
      remaining: 8,
    },
    {
      id: "line-b",
      sku: "DEM-00004",
      name: "Hook",
      qty: 6,
      receivedQty: 6,
      remaining: 0,
    },
  ];

  it("filters the receive table and builds submit payload", () => {
    expect(filterReceiveLines(rows, "connector", false)).toEqual([rows[0]]);
    expect(receiveLinesPayload(rows, { "line-a": 5, "line-b": 0 })).toEqual([
      { lineId: "line-a", quantity: 5 },
    ]);
  });

  it("exposes receive gates used by the document body", () => {
    const lines = rows.map(({ qty, receivedQty }) => ({ qty, receivedQty }));
    expect(receivingCanReceive("confirmed", 8)).toBe(true);
    expect(receivingCanCancelRemaining("confirmed", 8, lines)).toBe(true);
    expect(receivingShowShortPanel("received", [{ qty: 6, receivedQty: 4 }])).toBe(true);
  });
});
