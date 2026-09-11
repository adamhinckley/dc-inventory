import { describe, expect, it } from "vitest";
import {
  formatOrderStatus,
  isVisibleOrderStatus,
  orderHistoryPath,
  orderLineSubtotalCents,
  orderSubtotalCents,
  VISIBLE_ORDER_STATUSES,
} from "./order-history";

describe("order history visibility", () => {
  it("shows confirmed, shipped, and cancelled orders only", () => {
    expect(VISIBLE_ORDER_STATUSES).toEqual(["confirmed", "shipped", "cancelled"]);
    expect(isVisibleOrderStatus("draft")).toBe(false);
    expect(isVisibleOrderStatus("confirmed")).toBe(true);
    expect(isVisibleOrderStatus("shipped")).toBe(true);
    expect(isVisibleOrderStatus("cancelled")).toBe(true);
  });
});

describe("order history display helpers", () => {
  it("computes line and order subtotals from qty and unit price", () => {
    expect(orderLineSubtotalCents(3, 250)).toBe(750);
    expect(
      orderSubtotalCents([
        { qty: 3, unitPriceCents: 250 },
        { qty: 1, unitPriceCents: 100 },
      ]),
    ).toBe(850);
  });

  it("builds a document-number path and title-cases status", () => {
    expect(orderHistoryPath("SO-00042")).toBe("/orders/SO-00042");
    expect(formatOrderStatus("confirmed")).toBe("Confirmed");
    expect(formatOrderStatus("shipped")).toBe("Shipped");
    expect(formatOrderStatus("")).toBe("");
  });
});
