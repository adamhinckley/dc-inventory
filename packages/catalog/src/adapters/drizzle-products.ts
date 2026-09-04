import { Money, OrganizationId, ProductId, Sku } from "@dc-inventory/shared-kernel";
import { and, eq, ilike, inArray, or } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Product } from "../domain/product.js";
import type {
  IProductRepository,
  ListedProduct,
  ProductListMatch,
} from "../domain/ports/product-repository.js";
import {
  categories,
  productCategories,
  products,
  productPackaging,
} from "../persistence/schema.js";

export type CatalogDrizzle = PostgresJsDatabase<{
  categories: typeof categories;
  productCategories: typeof productCategories;
  products: typeof products;
  productPackaging: typeof productPackaging;
}>;

function toProduct(row: typeof products.$inferSelect): Product {
  return {
    id: ProductId.parse(row.id),
    organizationId: OrganizationId.parse(row.organizationId),
    sku: Sku.parse(row.sku),
    name: row.name,
    description: row.description,
    uom: row.uom,
    memberPrice: Money.fromMinorUnits(row.memberPriceCents, row.currency),
    listPrice:
      row.listPriceCents === null
        ? null
        : Money.fromMinorUnits(row.listPriceCents, row.currency),
    inactive: row.inactive,
    discontinued: row.discontinued,
    webWholesale: row.webWholesale,
    taxCategoryCode: row.taxCategoryCode,
  };
}

export function buildProductListQuery(
  db: CatalogDrizzle,
  query: ProductListMatch,
) {
  const clauses = [eq(products.organizationId, query.organizationId)];
  if (query.inactive !== undefined) {
    clauses.push(eq(products.inactive, query.inactive));
  }
  if (query.shopVisibleOnly === true) {
    clauses.push(eq(products.webWholesale, true));
    clauses.push(eq(products.inactive, false));
    clauses.push(eq(products.discontinued, false));
  }
  const needle = query.q?.trim() ?? "";
  if (needle.length > 0) {
    const pattern = `%${needle}%`;
    clauses.push(or(ilike(products.sku, pattern), ilike(products.name, pattern))!);
  }
  const category = query.category?.trim() ?? "";
  if (category.length > 0) {
    const productIds = db
      .select({ productId: productCategories.productId })
      .from(productCategories)
      .innerJoin(categories, eq(categories.id, productCategories.categoryId))
      .where(
        and(
          eq(categories.organizationId, query.organizationId),
          eq(categories.name, category),
        ),
      );
    clauses.push(inArray(products.id, productIds));
  }
  return db.select().from(products).where(and(...clauses));
}

export class DrizzleProductRepository implements IProductRepository {
  constructor(private readonly db: CatalogDrizzle) {}

  async listMatching(query: ProductListMatch): Promise<ListedProduct[]> {
    const rows = await buildProductListQuery(this.db, query);
    return rows.map((row) => ({
      product: toProduct(row),
      createdAt: row.createdAt,
    }));
  }

  async findById(organizationId: OrganizationId, id: ProductId): Promise<Product | null> {
    const rows = await this.db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.organizationId, organizationId)))
      .limit(1);
    return rows[0] === undefined ? null : toProduct(rows[0]);
  }

  async findBySku(organizationId: OrganizationId, sku: Sku): Promise<Product | null> {
    const rows = await this.db
      .select()
      .from(products)
      .where(and(eq(products.organizationId, organizationId), eq(products.sku, sku.value)))
      .limit(1);
    return rows[0] === undefined ? null : toProduct(rows[0]);
  }

  async save(product: Product): Promise<void> {
    await this.db
      .insert(products)
      .values({
        id: product.id,
        organizationId: product.organizationId,
        sku: product.sku.value,
        name: product.name,
        description: product.description,
        uom: product.uom,
        memberPriceCents: product.memberPrice.amountMinor,
        listPriceCents: product.listPrice?.amountMinor ?? null,
        currency: product.memberPrice.currency,
        inactive: product.inactive,
        discontinued: product.discontinued,
        webWholesale: product.webWholesale,
        taxCategoryCode: product.taxCategoryCode,
      })
      .onConflictDoUpdate({
        target: products.id,
        set: {
          name: product.name,
          description: product.description,
          uom: product.uom,
          memberPriceCents: product.memberPrice.amountMinor,
          listPriceCents: product.listPrice?.amountMinor ?? null,
          currency: product.memberPrice.currency,
          inactive: product.inactive,
          discontinued: product.discontinued,
          webWholesale: product.webWholesale,
          taxCategoryCode: product.taxCategoryCode,
          updatedAt: new Date(),
        },
      });
  }
}
