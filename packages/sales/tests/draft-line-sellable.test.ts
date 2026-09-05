import { Money, OrganizationId, ProductId, Sku } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import {
  lockedDraftIncreaseShortage,
  lockedDraftShortage,
} from "../src/application/draft-line-sellable.js";
import type { ProductSnapshot } from "../src/domain/ports/catalog-product.js";

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
