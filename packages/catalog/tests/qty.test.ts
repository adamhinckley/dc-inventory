import { describe, expect, it } from "vitest";
import {
  isWholesaleHiddenBeforeOpen,
  isShopSellable,
  shopAvailabilityLabel,
  shopDisplayAvailableQty,
  type ProductQty,
} from "../src/domain/qty.js";

function qty(overrides: Partial<ProductQty>): ProductQty {
  return {
    onHand: 0,
    onOrder: 0,
    allocated: 0,
    available: 0,
    committed: 0,
    sellState: "open",
    availableToSell: null,
    ...overrides,
  };
}

describe("isWholesaleHiddenBeforeOpen", () => {
  const now = new Date("2026-09-03T12:00:00.000Z");
  const futureOpens = new Date("2026-09-03T13:00:00.000Z");

  it("hides SKUs scheduled before windowOpensAt", () => {
    expect(
      isWholesaleHiddenBeforeOpen(
        qty({
          sellState: "locked",
          windowOpensAt: futureOpens,
          availableToSell: 10,
        }),
        { now },
      ),
    ).toBe(true);
  });

  it("keeps post-close sticky locked SKUs visible", () => {
    expect(
      isWholesaleHiddenBeforeOpen(
        qty({
          sellState: "locked",
          stickyLocked: true,
          windowOpensAt: futureOpens,
          availableToSell: 5,
        }),
        { now },
      ),
    ).toBe(false);
  });

  it("shows snapshot-scheduled SKUs when a SellWindow membership is active", () => {
    expect(
      isWholesaleHiddenBeforeOpen(
        qty({
          sellState: "open",
          windowOpensAt: futureOpens,
          hasActiveSellWindowMembership: true,
        }),
        { now },
      ),
    ).toBe(false);
  });
});

describe("isShopSellable", () => {
  it("includes open SKUs with warehouse leftover", () => {
    expect(isShopSellable(qty({ available: 12 }))).toBe(true);
  });

  it("includes open SKUs with no warehouse leftover", () => {
    expect(isShopSellable(qty({ available: 0 }))).toBe(true);
  });

  it("includes locked SKUs with availableToSell on PO", () => {
    expect(
      isShopSellable(
        qty({
          sellState: "locked",
          availableToSell: 100,
        }),
      ),
    ).toBe(true);
  });

  it("excludes locked SKUs with zero availableToSell even when leftover remains", () => {
    expect(
      isShopSellable(
        qty({
          sellState: "locked",
          available: 5,
          availableToSell: 0,
        }),
      ),
    ).toBe(false);
  });
});

describe("shopDisplayAvailableQty", () => {
  it("returns null for open SKUs (no warehouse leftover on shop)", () => {
    expect(shopDisplayAvailableQty(qty({ available: 12 }))).toBeNull();
  });

  it("shows availableToSell for locked SKUs", () => {
    expect(
      shopDisplayAvailableQty(
        qty({
          sellState: "locked",
          available: 0,
          availableToSell: 1987987,
        }),
      ),
    ).toBe(1987987);
  });

  it("returns null for locked SKUs with leftover but zero availableToSell", () => {
    expect(
      shopDisplayAvailableQty(
        qty({
          sellState: "locked",
          available: 5,
          availableToSell: 0,
        }),
      ),
    ).toBeNull();
  });
});

describe("shopAvailabilityLabel", () => {
  it("shows Available to order for open SKUs", () => {
    expect(shopAvailabilityLabel(qty({ available: 12 }))).toEqual({
      inStock: true,
      label: "Available to order",
    });
  });

  it("shows Available to order for open SKUs with no warehouse leftover", () => {
    expect(shopAvailabilityLabel(qty({ available: 0 }))).toEqual({
      inStock: true,
      label: "Available to order",
    });
  });

  it("marks locked leftover with zero ATP unavailable", () => {
    expect(
      shopAvailabilityLabel(
        qty({
          sellState: "locked",
          available: 5,
          availableToSell: 0,
        }),
      ),
    ).toEqual({ inStock: false, label: "Unavailable" });
  });
});
