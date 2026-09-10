import {
  InMemoryProductPackagingRepository,
  InMemoryProductRepository,
  emptyProductPackaging,
} from "@dc-inventory/catalog";
import { CreateProductUseCase } from "@dc-inventory/catalog";
import { Money, OrganizationId, ProductId, Sku, StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it, vi } from "vitest";
import { catalogSkuLookupPort, factorySendCatalogPort } from "./purchasing-catalog-ports.js";

const OTHER_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");
const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");

async function seedProduct(products: InMemoryProductRepository, sku: string) {
  const created = await new CreateProductUseCase(products).execute({
    organizationId: OrganizationId.DEFAULT,
    staffUserId: STAFF_ID,
    sku,
    name: sku,
    uom: "EA",
    memberPriceCents: 100,
    listPriceCents: 50,
    currency: "USD",
    webWholesale: true,
  });
  if (!created.ok) {
    throw new Error(`expected product create for ${sku}`);
  }
  return created.product;
}

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
      memberPrice: Money.fromMinorUnits(100, "USD"),
      listPrice: null,
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
    await expect(catalog.findBySkus(OrganizationId.DEFAULT, [sku])).resolves.toEqual(
      new Map([[sku.value, { sku, name: "Authoritative catalog name", archived: true }]]),
    );
    await expect(catalog.findBySkus(OTHER_ORG, [sku])).resolves.toEqual(new Map());
  });
});

describe("factorySendCatalogPort", () => {
  it("loads case qty with one findBySkus and one findByProductIds call", async () => {
    const products = new InMemoryProductRepository();
    const packaging = new InMemoryProductPackagingRepository();
    const skuA = Sku.parse("FACTORY-SEND-A");
    const skuB = Sku.parse("FACTORY-SEND-B");
    const productA = await seedProduct(products, skuA.value);
    const productB = await seedProduct(products, skuB.value);
    await packaging.saveMany([
      { ...emptyProductPackaging(productA.id), caseQty: 48 },
      { ...emptyProductPackaging(productB.id), caseQty: 96 },
    ]);

    const findBySkus = vi.spyOn(products, "findBySkus");
    const findByProductId = vi.spyOn(packaging, "findByProductId");
    const findByProductIds = vi.spyOn(packaging, "findByProductIds");
    const port = factorySendCatalogPort(products, packaging);

    const rows = await port.readBySkus(OrganizationId.DEFAULT, [skuA, skuB, Sku.parse("MISSING-SKU")]);

    expect(rows.get(skuA.value)).toEqual({ caseQty: 48 });
    expect(rows.get(skuB.value)).toEqual({ caseQty: 96 });
    expect(rows.get("MISSING-SKU")).toEqual({ caseQty: null });
    expect(findBySkus).toHaveBeenCalledTimes(1);
    expect(findByProductIds).toHaveBeenCalledTimes(1);
    expect(findByProductId).not.toHaveBeenCalled();
    expect(findByProductIds.mock.calls[0]?.[0]).toHaveLength(2);
  });
});
