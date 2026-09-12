import { describe, expect, it } from "vitest";
import {
  isWholesaleHiddenBeforeOpen,
  isShopSellable,
  isWarehouseReady,
  isOpenPresale,
  matchesWholesaleAvailabilityFilter,
  resolveWholesaleAvailabilityFilters,
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

describe("isWarehouseReady", () => {
  it("is true for locked SKUs with ATP > 0", () => {
    expect(
      isWarehouseReady(
        qty({
          sellState: "locked",
          availableToSell: 100,
        }),
      ),
    ).toBe(true);
  });

  it("is false for open SKUs", () => {
    expect(isWarehouseReady(qty({ available: 12 }))).toBe(false);
  });

  it("is false for locked sold-out SKUs even with warehouse leftover", () => {
    expect(
      isWarehouseReady(
        qty({
          sellState: "locked",
          available: 5,
          availableToSell: 0,
        }),
      ),
    ).toBe(false);
  });
});

describe("isOpenPresale", () => {
  it("is true for open SKUs", () => {
    expect(isOpenPresale(qty({ available: 0 }))).toBe(true);
  });

  it("is false for locked SKUs", () => {
    expect(isOpenPresale(qty({ sellState: "locked", availableToSell: 10 }))).toBe(false);
  });
});

describe("resolveWholesaleAvailabilityFilters", () => {
  it("maps legacy availableOnly true to both toggles on", () => {
    expect(resolveWholesaleAvailabilityFilters({ availableOnly: true })).toEqual({
      inStockOnly: true,
      preOrderOnly: true,
    });
  });

  it("maps legacy availableOnly false to both toggles off", () => {
    expect(resolveWholesaleAvailabilityFilters({ availableOnly: false })).toEqual({
      inStockOnly: false,
      preOrderOnly: false,
    });
  });

  it("defaults both toggles on when unset", () => {
    expect(resolveWholesaleAvailabilityFilters({})).toEqual({
      inStockOnly: true,
      preOrderOnly: true,
    });
  });
});

describe("matchesWholesaleAvailabilityFilter", () => {
  const openEmpty = qty({ available: 0 });
  const openStocked = qty({ available: 4 });
  const lockedOnPo = qty({ sellState: "locked", availableToSell: 100 });
  const lockedSoldOut = qty({
    sellState: "locked",
    available: 5,
    availableToSell: 0,
  });

  it("inStock on + preOrder on shows locked ATP>0 or open", () => {
    const filters = { inStockOnly: true, preOrderOnly: true };
    expect(matchesWholesaleAvailabilityFilter(openEmpty, filters)).toBe(true);
    expect(matchesWholesaleAvailabilityFilter(openStocked, filters)).toBe(true);
    expect(matchesWholesaleAvailabilityFilter(lockedOnPo, filters)).toBe(true);
    expect(matchesWholesaleAvailabilityFilter(lockedSoldOut, filters)).toBe(false);
  });

  it("inStock on + preOrder off shows locked ATP>0 only", () => {
    const filters = { inStockOnly: true, preOrderOnly: false };
    expect(matchesWholesaleAvailabilityFilter(openEmpty, filters)).toBe(false);
    expect(matchesWholesaleAvailabilityFilter(openStocked, filters)).toBe(false);
    expect(matchesWholesaleAvailabilityFilter(lockedOnPo, filters)).toBe(true);
    expect(matchesWholesaleAvailabilityFilter(lockedSoldOut, filters)).toBe(false);
  });

  it("inStock off + preOrder on shows open only", () => {
    const filters = { inStockOnly: false, preOrderOnly: true };
    expect(matchesWholesaleAvailabilityFilter(openEmpty, filters)).toBe(true);
    expect(matchesWholesaleAvailabilityFilter(openStocked, filters)).toBe(true);
    expect(matchesWholesaleAvailabilityFilter(lockedOnPo, filters)).toBe(false);
    expect(matchesWholesaleAvailabilityFilter(lockedSoldOut, filters)).toBe(false);
  });

  it("inStock off + preOrder off shows all shop-visible rows", () => {
    const filters = { inStockOnly: false, preOrderOnly: false };
    expect(matchesWholesaleAvailabilityFilter(openEmpty, filters)).toBe(true);
    expect(matchesWholesaleAvailabilityFilter(openStocked, filters)).toBe(true);
    expect(matchesWholesaleAvailabilityFilter(lockedOnPo, filters)).toBe(true);
    expect(matchesWholesaleAvailabilityFilter(lockedSoldOut, filters)).toBe(true);
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
