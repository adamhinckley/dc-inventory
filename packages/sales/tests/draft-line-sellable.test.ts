import { Money, OrganizationId, ProductId, Sku } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import {
  isPostCloseCartFrozen,
  lockedDraftIncreaseShortage,
  lockedDraftShortage,
} from "../src/application/draft-line-sellable.js";
import type { ProductSnapshot } from "../src/domain/ports/catalog-product.js";

const NOW = new Date("2026-09-03T12:00:00.000Z");
const FUTURE_OPENS = new Date("2026-09-03T13:00:00.000Z");
const PAST_CLOSES = new Date("2026-09-03T11:00:00.000Z");

const product: ProductSnapshot = {
  productId: ProductId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
  organizationId: OrganizationId.DEFAULT,
  sku: Sku.parse("LOCKED-VASE"),
  name: "10”H Glass Vase - Pink (1/4)",
  unitPrice: Money.fromMinorUnits(100, "USD"),
  active: true,
  sellState: "locked",
  availableToSell: 5,
};

describe("lockedDraftShortage", () => {
  it("rejects qty above locked available-to-sell", () => {
    expect(lockedDraftShortage(product, 7)).toEqual({
      sku: "LOCKED-VASE",
      name: "10”H Glass Vase - Pink (1/4)",
      requestedQty: 7,
      availableQty: 5,
    });
  });

  it("allows qty at the locked cap", () => {
    expect(lockedDraftShortage(product, 5)).toBeNull();
  });

  it("does not cap snapshots without a locked sell state", () => {
    expect(lockedDraftShortage({ ...product, sellState: "open" }, 7)).toBeNull();
    expect(
      lockedDraftShortage(
        {
          ...product,
          sellState: undefined,
          availableToSell: undefined,
        },
        7,
      ),
    ).toBeNull();
  });
});

describe("lockedDraftIncreaseShortage", () => {
  it("allows keeping or lowering an already-oversold draft qty", () => {
    expect(lockedDraftIncreaseShortage(product, 345_346, 345_346)).toBeNull();
    expect(lockedDraftIncreaseShortage(product, 1, 345_346)).toBeNull();
  });

  it("rejects raising a draft qty further above available-to-sell", () => {
    expect(lockedDraftIncreaseShortage(product, 7, 5)).toEqual({
      sku: "LOCKED-VASE",
      name: "10”H Glass Vase - Pink (1/4)",
      requestedQty: 7,
      availableQty: 5,
    });
  });
});

describe("isPostCloseCartFrozen", () => {
  it("treats sticky locked SKUs as frozen after close", () => {
    expect(
      isPostCloseCartFrozen(
        {
          ...product,
          stickyLocked: true,
        },
        NOW,
      ),
    ).toBe(true);
  });

  it("treats closed windows without active membership as frozen", () => {
    expect(
      isPostCloseCartFrozen(
        {
          ...product,
          stickyLocked: false,
          windowOpensAt: new Date("2026-09-03T10:00:00.000Z"),
          windowClosesAt: PAST_CLOSES,
          hasActiveSellWindowMembership: false,
        },
        NOW,
      ),
    ).toBe(true);
  });

  it("does not freeze inbound PO locks without sell windows", () => {
    expect(isPostCloseCartFrozen(product, NOW)).toBe(false);
  });

  it("does not freeze future scheduled SKUs before open", () => {
    expect(
      isPostCloseCartFrozen(
        {
          ...product,
          windowOpensAt: FUTURE_OPENS,
        },
        NOW,
      ),
    ).toBe(false);
  });
});

describe("post-close draft cart gates", () => {
  const postClose: ProductSnapshot = {
    ...product,
    stickyLocked: true,
    availableToSell: 12,
  };

  it("blocks adding a new post-close line even when ATP allows it", () => {
    expect(lockedDraftIncreaseShortage(postClose, 3, 0, NOW)).toEqual({
      sku: "LOCKED-VASE",
      name: "10”H Glass Vase - Pink (1/4)",
      requestedQty: 3,
      availableQty: 0,
    });
  });

  it("blocks raising qty on a post-close line but allows lowering", () => {
    expect(lockedDraftIncreaseShortage(postClose, 8, 5, NOW)).toEqual({
      sku: "LOCKED-VASE",
      name: "10”H Glass Vase - Pink (1/4)",
      requestedQty: 8,
      availableQty: 5,
    });
    expect(lockedDraftIncreaseShortage(postClose, 4, 5, NOW)).toBeNull();
  });
});
