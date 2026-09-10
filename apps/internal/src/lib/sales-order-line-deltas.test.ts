import { describe, expect, it } from "vitest";
import {
  hasSalesOrderLineDeltaWork,
  salesOrderLineDeltaBody,
} from "./sales-order-line-deltas";

describe("salesOrderLineDeltaBody", () => {
  it("emits add, update, and remove without resending untouched lines", () => {
    const body = salesOrderLineDeltaBody(
      [
        {
          rowKey: "OPEN",
          productId: "p-open",
          sku: "OPEN",
          name: "Open",
          qty: 2,
          unitPriceCents: 100,
          currency: "USD",
        },
        {
          rowKey: "LOCK",
          productId: "p-lock",
          sku: "LOCK",
          name: "Lock",
          qty: 1,
          unitPriceCents: 200,
          currency: "USD",
        },
      ],
      [
        {
          rowKey: "OPEN",
          productId: "p-open",
          sku: "OPEN",
          name: "Open",
          qty: 4,
          unitPriceCents: 100,
          currency: "USD",
        },
        {
          rowKey: "COVER",
          productId: "p-cover",
          sku: "COVER",
          name: "Cover",
          qty: 3,
          unitPriceCents: 300,
          currency: "USD",
        },
      ],
    );

    expect(body).toEqual({
      update: [{ sku: "OPEN", qty: 4 }],
      remove: ["LOCK"],
      add: [{ productId: "p-cover", qty: 3 }],
    });
    expect(hasSalesOrderLineDeltaWork(body)).toBe(true);
  });
});
