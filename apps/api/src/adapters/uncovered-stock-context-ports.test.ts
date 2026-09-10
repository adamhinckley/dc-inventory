import {
  InMemoryProductPackagingRepository,
  InMemoryProductRepository,
  emptyProductPackaging,
} from "@dc-inventory/catalog";
import { CreateProductUseCase } from "@dc-inventory/catalog";
import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { Sku } from "@dc-inventory/shared-kernel";
import { describe, expect, it, vi } from "vitest";
import { uncoveredCaseQtyReadPort } from "./uncovered-stock-context-ports.js";

const ORG = OrganizationId.DEFAULT;
const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");

async function seedProduct(products: InMemoryProductRepository, sku: string) {
  const created = await new CreateProductUseCase(products).execute({
    organizationId: ORG,
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

describe("uncoveredCaseQtyReadPort", () => {
  it("loads case qty with one findBySkus and one findByProductIds call", async () => {
    const products = new InMemoryProductRepository();
    const packaging = new InMemoryProductPackagingRepository();
    const skuA = Sku.parse("CASE-QTY-A");
    const skuB = Sku.parse("CASE-QTY-B");
    const productA = await seedProduct(products, skuA.value);
    const productB = await seedProduct(products, skuB.value);
    await packaging.saveMany([
      { ...emptyProductPackaging(productA.id), caseQty: 48 },
      { ...emptyProductPackaging(productB.id), caseQty: 96 },
    ]);

    const findBySkus = vi.spyOn(products, "findBySkus");
    const findByProductId = vi.spyOn(packaging, "findByProductId");
    const findByProductIds = vi.spyOn(packaging, "findByProductIds");
    const port = uncoveredCaseQtyReadPort(products, packaging);

    const rows = await port.readBySkus(ORG, [skuA, skuB, Sku.parse("MISSING-SKU")]);

    expect(rows.get(skuA.value)).toEqual({ caseQty: 48 });
    expect(rows.get(skuB.value)).toEqual({ caseQty: 96 });
    expect(rows.get("MISSING-SKU")).toEqual({ caseQty: null });
    expect(findBySkus).toHaveBeenCalledTimes(1);
    expect(findByProductIds).toHaveBeenCalledTimes(1);
    expect(findByProductId).not.toHaveBeenCalled();
    expect(findByProductIds.mock.calls[0]?.[0]).toHaveLength(2);
  });
});
