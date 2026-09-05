import { describe, expect, it } from "vitest";
import { isVisibleOrderStatus, VISIBLE_ORDER_STATUSES } from "./order-history";

describe("order history visibility", () => {
  it("shows confirmed, shipped, and cancelled orders only", () => {
    expect(VISIBLE_ORDER_STATUSES).toEqual(["confirmed", "shipped", "cancelled"]);
    expect(isVisibleOrderStatus("draft")).toBe(false);
    expect(isVisibleOrderStatus("confirmed")).toBe(true);
    expect(isVisibleOrderStatus("shipped")).toBe(true);
    expect(isVisibleOrderStatus("cancelled")).toBe(true);
  });
});
