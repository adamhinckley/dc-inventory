import { describe, expect, it } from "vitest";
import {
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

describe("isShopSellable", () => {
  it("includes open SKUs with warehouse leftover", () => {
    expect(isShopSellable(qty({ available: 12 }))).toBe(true);
  });

  it("excludes open SKUs with no warehouse leftover", () => {
    expect(isShopSellable(qty({ available: 0 }))).toBe(false);
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
  it("shows warehouse leftover for open SKUs", () => {
    expect(shopDisplayAvailableQty(qty({ available: 12 }))).toBe(12);
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
  it("formats sellable open stock", () => {
    expect(shopAvailabilityLabel(qty({ available: 12 }))).toEqual({
      inStock: true,
      label: "12 available",
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
