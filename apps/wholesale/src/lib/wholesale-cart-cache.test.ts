import { describe, expect, it } from "vitest";
import {
  buildOptimisticDraftOrder,
  writeDraftCartOrder,
  wholesaleDraftCartQueryKey,
  readDraftCartList,
} from "./wholesale-cart-cache";
import { QueryClient } from "@tanstack/react-query";
import type { WholesaleDraftCartOrder } from "./wholesale-cart-cache";

describe("buildOptimisticDraftOrder", () => {
  const draft: WholesaleDraftCartOrder = {
    id: "order-1",
    customerId: "cust-1",
    documentNumber: "SO-0001",
    status: "draft" as const,
    lines: [
      {
        id: "line-a",
        productId: "prod-a",
        sku: "A",
        name: "Alpha",
        qty: 2,
        unitPriceCents: 100,
        currency: "USD",
      },
      {
        id: "line-b",
        productId: "prod-b",
        sku: "B",
        name: "Beta",
        qty: 1,
        unitPriceCents: 200,
        currency: "USD",
      },
    ],
  };

  it("updates qty on an existing line instantly", () => {
    const next = buildOptimisticDraftOrder(draft, [
      { productId: "prod-a", qty: 5 },
      { productId: "prod-b", qty: 1 },
    ]);
    expect(next.lines.find((line) => line.productId === "prod-a")?.qty).toBe(5);
    expect(next.lines.find((line) => line.productId === "prod-a")?.unitPriceCents).toBe(
      100,
    );
  });

  it("adds a new line with provided meta", () => {
    const next = buildOptimisticDraftOrder(
      draft,
      [
        { productId: "prod-a", qty: 2 },
        { productId: "prod-c", qty: 3 },
      ],
      new Map([
        [
          "prod-c",
          { name: "Gamma", unitPriceCents: 300, currency: "USD", sku: "C" },
        ],
      ]),
    );
    expect(next.lines).toHaveLength(2);
    expect(next.lines[1]).toMatchObject({
      productId: "prod-c",
      name: "Gamma",
      qty: 3,
      unitPriceCents: 300,
    });
  });
});

describe("writeDraftCartOrder", () => {
  it("writes the draft list cache used by the cart query", () => {
    const queryClient = new QueryClient();
    writeDraftCartOrder(queryClient, {
      id: "order-1",
      customerId: "cust-1",
      documentNumber: "SO-0001",
      status: "draft",
      lines: [],
    });
    const cached = readDraftCartList(queryClient);
    expect(cached?.data.items[0]?.id).toBe("order-1");
    expect(queryClient.getQueryData(wholesaleDraftCartQueryKey)).toBeDefined();
  });
});
