import { describe, expect, it } from "vitest";
import { cartDeltaBaselineLines, cartLinesToDeltaBody, hasCartLineDeltaWork } from "./cart-line-deltas";
import type { WholesaleDraftCartListResult } from "./wholesale-cart-cache";

describe("cartDeltaBaselineLines", () => {
  it("uses burstPrevious lines when optimistic cache already matches the target", () => {
    const baseline = cartDeltaBaselineLines(
      "draft-1",
      [{ id: "line-open", productId: "p-open", sku: "OPEN", name: "Open", qty: 5, unitPriceCents: 100, currency: "USD" }],
      {
        status: 200,
        headers: new Headers(),
        data: {
          items: [
            {
              id: "draft-1",
              customerId: "cust",
              documentNumber: "SO-1",
              status: "draft",
              lines: [
                {
                  id: "line-open",
                  productId: "p-open",
                  sku: "OPEN",
                  name: "Open",
                  qty: 2,
                  unitPriceCents: 100,
                  currency: "USD",
                },
              ],
            },
          ],
          page: 1,
          pageSize: 25,
          total: 1,
        },
      } satisfies WholesaleDraftCartListResult,
    );

    const body = cartLinesToDeltaBody(baseline, [{ productId: "p-open", qty: 5 }]);
    expect(body).toEqual({ update: [{ lineId: "line-open", qty: 5 }] });
    expect(hasCartLineDeltaWork(body)).toBe(true);
  });
});

describe("cartLinesToDeltaBody", () => {
  it("sends only an add when one SKU is appended to a multi-line draft", () => {
    const body = cartLinesToDeltaBody(
      [
        {
          id: "line-open",
          productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          sku: "SALES-OPEN-1",
          name: "Open",
          qty: 2,
          unitPriceCents: 500,
          currency: "USD",
        },
        {
          id: "line-lock",
          productId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          sku: "SALES-LOCK-1",
          name: "Lock",
          qty: 3,
          unitPriceCents: 700,
          currency: "USD",
        },
      ],
      [
        { productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", qty: 2 },
        { productId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", qty: 3 },
        { productId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", qty: 1 },
      ],
    );

    expect(body).toEqual({
      add: [{ productId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", qty: 1 }],
    });
    expect(hasCartLineDeltaWork(body)).toBe(true);
  });

  it("sends update and remove without resending untouched lines", () => {
    const body = cartLinesToDeltaBody(
      [
        {
          id: "line-open",
          productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          sku: "SALES-OPEN-1",
          name: "Open",
          qty: 2,
          unitPriceCents: 500,
          currency: "USD",
        },
        {
          id: "line-lock",
          productId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          sku: "SALES-LOCK-1",
          name: "Lock",
          qty: 3,
          unitPriceCents: 700,
          currency: "USD",
        },
      ],
      [{ productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", qty: 5 }],
    );

    expect(body).toEqual({
      update: [{ lineId: "line-open", qty: 5 }],
      remove: ["line-lock"],
    });
  });
});
