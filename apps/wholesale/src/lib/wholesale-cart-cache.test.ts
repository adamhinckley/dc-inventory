import { describe, expect, it } from "vitest";
import {
  buildOptimisticDraftOrder,
  readDraftCartOrder,
  removeDraftCartOrder,
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
  const line = {
    id: "line-a",
    productId: "prod-a",
    sku: "A",
    name: "Alpha",
    qty: 1,
    unitPriceCents: 100,
    currency: "USD",
  };
  const cartOne: WholesaleDraftCartOrder = {
    id: "order-1",
    customerId: "cust-1",
    documentNumber: "SO-0001",
    status: "draft",
    lines: [line],
  };
  const cartTwo: WholesaleDraftCartOrder = {
    ...cartOne,
    id: "order-2",
    documentNumber: "SO-0002",
    label: "Spring",
  };

  it("seeds the open-carts list cache used by the cart query", () => {
    const queryClient = new QueryClient();
    writeDraftCartOrder(queryClient, cartOne);
    const cached = readDraftCartList(queryClient);
    expect(cached?.data.items.map((item) => item.id)).toEqual(["order-1"]);
    expect(cached?.data.total).toBe(1);
    expect(queryClient.getQueryData(wholesaleDraftCartQueryKey)).toBeDefined();
  });

  it("puts a new cart first and leaves sibling carts alone", () => {
    const queryClient = new QueryClient();
    writeDraftCartOrder(queryClient, cartOne);
    writeDraftCartOrder(queryClient, cartTwo);
    expect(readDraftCartList(queryClient)?.data.items.map((item) => item.id)).toEqual([
      "order-2",
      "order-1",
    ]);
  });

  it("replaces an existing cart in place instead of reordering", () => {
    const queryClient = new QueryClient();
    writeDraftCartOrder(queryClient, cartOne);
    writeDraftCartOrder(queryClient, cartTwo);
    writeDraftCartOrder(queryClient, { ...cartOne, lines: [{ ...line, qty: 9 }] });
    const items = readDraftCartList(queryClient)?.data.items ?? [];
    expect(items.map((item) => item.id)).toEqual(["order-2", "order-1"]);
    expect(items[1]?.lines[0]?.qty).toBe(9);
    expect(readDraftCartOrder(queryClient, "order-2")?.label).toBe("Spring");
  });

  it("drops a cart that was cancelled or emptied, keeping the others", () => {
    const queryClient = new QueryClient();
    writeDraftCartOrder(queryClient, cartOne);
    writeDraftCartOrder(queryClient, cartTwo);
    writeDraftCartOrder(queryClient, { ...cartTwo, status: "cancelled", lines: [] });
    expect(readDraftCartList(queryClient)?.data.items.map((item) => item.id)).toEqual([
      "order-1",
    ]);
    removeDraftCartOrder(queryClient, "order-1");
    expect(readDraftCartList(queryClient)?.data.items).toEqual([]);
    expect(readDraftCartList(queryClient)?.data.total).toBe(0);
  });
});
