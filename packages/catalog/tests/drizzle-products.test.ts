import { OrganizationId } from "@dc-inventory/shared-kernel";
import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vitest";
import {
  buildProductListQuery,
  type CatalogDrizzle,
} from "../src/adapters/drizzle-products.js";
import {
  categories,
  productCategories,
  productPackaging,
  products,
} from "../src/persistence/schema.js";

describe("DrizzleProductRepository queries", () => {
  it("constrains category matches through Catalog category relations", () => {
    const db = drizzle.mock({
      schema: { categories, productCategories, productPackaging, products },
    }) as CatalogDrizzle;

    const query = buildProductListQuery(db, {
      organizationId: OrganizationId.DEFAULT,
      category: "Hardware",
      shopVisibleOnly: true,
    }).toSQL();

    expect(query.sql).toContain('"catalog"."product_categories"');
    expect(query.sql).toContain('"catalog"."categories"');
    expect(query.params).toContain("Hardware");
  });
});
