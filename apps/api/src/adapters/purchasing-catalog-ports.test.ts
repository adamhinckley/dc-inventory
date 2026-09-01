import { InMemoryProductRepository } from "@dc-inventory/catalog";
import { Money, OrganizationId, ProductId, Sku } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { catalogSkuLookupPort } from "./purchasing-catalog-ports.js";

const OTHER_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");

describe("Purchasing Catalog anti-corruption adapter", () => {
  it("maps authoritative product identity and archive state without leaking Product", async () => {
    const products = new InMemoryProductRepository();
    const sku = Sku.parse("PO-CATALOG-SKU");
    await products.save({
      id: ProductId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      organizationId: OrganizationId.DEFAULT,
      sku,
      name: "Authoritative catalog name",
      description: null,
      uom: "EA",
      masterPackPrice: Money.fromMinorUnits(100, "USD"),
      inactive: true,
      discontinued: false,
      webWholesale: false,
      taxCategoryCode: null,
    });

    const catalog = catalogSkuLookupPort(products);

    await expect(catalog.findBySku(OrganizationId.DEFAULT, sku)).resolves.toEqual({
      sku,
      name: "Authoritative catalog name",
      archived: true,
    });
    await expect(catalog.findBySku(OTHER_ORG, sku)).resolves.toBeNull();
  });
});
