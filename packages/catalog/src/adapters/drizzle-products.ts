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
  const categoryNames = (query.category ?? [])
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  if (categoryNames.length > 0) {
    const productIds = db
      .select({ productId: productCategories.productId })
      .from(productCategories)
      .innerJoin(categories, eq(categories.id, productCategories.categoryId))
      .where(
        and(
          eq(categories.organizationId, query.organizationId),
          inArray(categories.name, categoryNames),
        ),
      );
    clauses.push(inArray(products.id, productIds));
  }
  return db.select().from(products).where(and(...clauses));
}

export class DrizzleProductRepository implements IProductRepository {
  constructor(private readonly db: CatalogDrizzle) {}

  async listCategoryNames(organizationId: OrganizationId): Promise<string[]> {
    const rows = await this.db
      .select({ name: categories.name })
      .from(categories)
      .where(eq(categories.organizationId, organizationId))
      .orderBy(categories.name);
    return rows.map((row) => row.name);
  }

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

  async findByIds(
    organizationId: OrganizationId,
    ids: readonly ProductId[],
  ): Promise<ReadonlyMap<string, Product>> {
    const result = new Map<string, Product>();
    if (ids.length === 0) {
      return result;
    }
    const rows = await this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.organizationId, organizationId),
          inArray(products.id, [...ids]),
        ),
      );
    for (const row of rows) {
      const product = toProduct(row);
      result.set(product.id, product);
    }
    return result;
  }

  async findBySku(organizationId: OrganizationId, sku: Sku): Promise<Product | null> {
    const rows = await this.db
      .select()
      .from(products)
      .where(and(eq(products.organizationId, organizationId), eq(products.sku, sku.value)))
      .limit(1);
    return rows[0] === undefined ? null : toProduct(rows[0]);
  }

  async findBySkus(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, Product>> {
    const result = new Map<string, Product>();
    if (skus.length === 0) {
      return result;
    }
    const rows = await this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.organizationId, organizationId),
          inArray(
            products.sku,
            skus.map((sku) => sku.value),
          ),
        ),
      );
    for (const row of rows) {
      const product = toProduct(row);
      result.set(product.sku.value, product);
    }
    return result;
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
