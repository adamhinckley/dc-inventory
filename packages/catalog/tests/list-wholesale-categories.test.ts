import { CustomerId, OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryProductRepository } from "../src/adapters/in-memory-product-repository.js";
import { CreateProductUseCase } from "../src/application/create-product.js";
import { ListStaffCategoriesUseCase } from "../src/application/list-staff-categories.js";
import { ListWholesaleCategoriesUseCase } from "../src/application/list-wholesale-categories.js";

const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440010");
const CUSTOMER_ID = CustomerId.parse("550e8400-e29b-41d4-a716-446655440020");
const DEFAULT_ORG = OrganizationId.DEFAULT;
const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");

async function seedProduct(
  products: InMemoryProductRepository,
  input: {
    organizationId?: OrganizationId;
    sku: string;
    categories: string[];
    webWholesale?: boolean;
    inactive?: boolean;
    discontinued?: boolean;
  },
) {
  const create = new CreateProductUseCase(products);
  const created = await create.execute({
    organizationId: input.organizationId ?? DEFAULT_ORG,
    staffUserId: STAFF_ID,
    sku: input.sku,
    name: input.sku,
    uom: "EA",
    memberPriceCents: 1000,
    listPriceCents: 100,
    currency: "USD",
    inactive: input.inactive ?? false,
    discontinued: input.discontinued ?? false,
    webWholesale: input.webWholesale ?? true,
  });
  if (!created.ok) {
    throw new Error(`expected create, got ${created.reason}`);
  }
  products.setCategories(created.product.id, input.categories);
  return created.product;
}

describe("ListWholesaleCategoriesUseCase", () => {
  it("lists only categories that have a shop-visible product, sorted by name", async () => {
    const products = new InMemoryProductRepository();
    await seedProduct(products, { sku: "RIBBON", categories: ["Ribbon", "Halloween"] });
    await seedProduct(products, {
      sku: "HIDDEN",
      categories: ["Staff only"],
      webWholesale: false,
    });
    await seedProduct(products, {
      sku: "GONE",
      categories: ["Discontinued line"],
      discontinued: true,
    });
    await seedProduct(products, {
      sku: "SLEEPING",
      categories: ["Inactive line"],
      inactive: true,
    });
    await seedProduct(products, {
      organizationId: BETA_ORG,
      sku: "OTHER-ORG",
      categories: ["Beta only"],
    });

    const result = await new ListWholesaleCategoriesUseCase(products).execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
    });

    expect(result.items).toEqual(["Halloween", "Ribbon"]);
  });

  it("keeps the staff list unfiltered so hidden-only categories stay editable", async () => {
    const products = new InMemoryProductRepository();
    await seedProduct(products, { sku: "RIBBON", categories: ["Ribbon"] });
    await seedProduct(products, {
      sku: "HIDDEN",
      categories: ["Staff only"],
      webWholesale: false,
    });

    const staff = await new ListStaffCategoriesUseCase(products).execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
    });
    const shop = await new ListWholesaleCategoriesUseCase(products).execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
    });

    expect(staff.items).toEqual(["Ribbon", "Staff only"]);
    expect(shop.items).toEqual(["Ribbon"]);
  });
});
