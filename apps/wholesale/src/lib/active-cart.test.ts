import { describe, expect, it } from "vitest";
import {
  cartDisplayName,
  cartLineCount,
  cartSubtotalCents,
  cartUnitCount,
  NEW_CART,
  resolveActiveCart,
} from "./active-cart.js";

const drafts = [
  { id: "newest", documentNumber: "SO-00012" },
  { id: "older", documentNumber: "SO-00009" },
];

describe("resolveActiveCart", () => {
  it("keeps the stored cart when it is still open", () => {
    expect(resolveActiveCart(drafts, "older")).toEqual({ kind: "draft", draft: drafts[1] });
  });

  it("falls back to the newest open cart when the stored one was checked out or deleted", () => {
    expect(resolveActiveCart(drafts, "gone")).toEqual({ kind: "draft", draft: drafts[0] });
    expect(resolveActiveCart(drafts, null)).toEqual({ kind: "draft", draft: drafts[0] });
  });

  it("honours Start New Cart even when other carts are open", () => {
    expect(resolveActiveCart(drafts, NEW_CART)).toEqual({ kind: "new" });
  });

  it("reports none when the customer has no open carts", () => {
    expect(resolveActiveCart([], null)).toEqual({ kind: "none" });
    expect(resolveActiveCart([], "gone")).toEqual({ kind: "none" });
  });
});

describe("cart summaries", () => {
  const cart = {
    label: "  Spring reorder ",
    documentNumber: "SO-00012",
    lines: [
      { qty: 2, unitPriceCents: 150, currency: "USD" },
      { qty: 5, unitPriceCents: 40, currency: "USD" },
    ],
  };

  it("prefers the buyer label and falls back to the document number", () => {
    expect(cartDisplayName(cart)).toBe("Spring reorder");
    expect(cartDisplayName({ documentNumber: "SO-00012" })).toBe("Cart SO-00012");
    expect(cartDisplayName({ label: "   ", documentNumber: "SO-00012" })).toBe("Cart SO-00012");
  });

  it("counts lines, units, and money separately", () => {
    expect(cartLineCount(cart)).toBe(2);
    expect(cartUnitCount(cart)).toBe(7);
    expect(cartSubtotalCents(cart)).toBe(500);
  });
});
