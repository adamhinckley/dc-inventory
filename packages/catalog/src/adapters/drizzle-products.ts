import { Money, OrganizationId, ProductId, Sku } from "@dc-inventory/shared-kernel";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Product } from "../domain/product.js";
import { emptyProductCatalogAttributes } from "../domain/product-catalog-attributes.js";
import type {
  IProductRepository,
  ListedProduct,
  ProductListMatch,
} from "../domain/ports/product-repository.js";
import {
  categories,
  productCategories,
  productIdentifiers,
  products,
  productPackaging,
} from "../persistence/schema.js";

export type CatalogDrizzle = PostgresJsDatabase<{
  categories: typeof categories;
  productCategories: typeof productCategories;
  productIdentifiers: typeof productIdentifiers;
  products: typeof products;
  productPackaging: typeof productPackaging;
}>;

function toProduct(row: typeof products.$inferSelect): Product {
  const defaults = emptyProductCatalogAttributes();
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
    countryOfOrigin: row.countryOfOrigin ?? defaults.countryOfOrigin,
    material: row.material ?? defaults.material,
    length: row.length ?? defaults.length,
    width: row.width ?? defaults.width,
    height: row.height ?? defaults.height,
    diameter: row.diameter ?? defaults.diameter,
    size: row.size ?? defaults.size,
    weight: row.weight ?? defaults.weight,
    weightUom: row.weightUom ?? defaults.weightUom,
    originalWholesalePrice:
      row.originalWholesalePriceCents === null
        ? null
        : Money.fromMinorUnits(row.originalWholesalePriceCents, row.currency),
    catalogPage: row.catalogPage ?? defaults.catalogPage,
    defaultOrderQty: row.defaultOrderQty ?? defaults.defaultOrderQty,
    defaultWeight: row.defaultWeight ?? defaults.defaultWeight,
    defaultWeightUom: row.defaultWeightUom ?? defaults.defaultWeightUom,
    nonStock: row.nonStock ?? defaults.nonStock,
    noExport: row.noExport ?? defaults.noExport,
    webRetail: row.webRetail ?? defaults.webRetail,
  };
}

function productToInsertRow(product: Product): typeof products.$inferInsert {
  return {
    id: product.id,
    organizationId: product.organizationId,
    sku: product.sku.value,
    name: product.name,
    description: product.description,
    uom: product.uom,
    countryOfOrigin: product.countryOfOrigin,
    material: product.material,
    length: product.length,
    width: product.width,
    height: product.height,
    diameter: product.diameter,
    size: product.size,
    weight: product.weight,
    weightUom: product.weightUom,
    memberPriceCents: product.memberPrice.amountMinor,
    listPriceCents: product.listPrice?.amountMinor ?? null,
    originalWholesalePriceCents: product.originalWholesalePrice?.amountMinor ?? null,
    currency: product.memberPrice.currency,
    catalogPage: product.catalogPage,
    defaultOrderQty: product.defaultOrderQty,
    defaultWeight: product.defaultWeight,
    defaultWeightUom: product.defaultWeightUom,
    inactive: product.inactive,
    discontinued: product.discontinued,
    nonStock: product.nonStock,
    noExport: product.noExport,
    webWholesale: product.webWholesale,
    webRetail: product.webRetail,
    taxCategoryCode: product.taxCategoryCode,
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
      .values(productToInsertRow(product))
      .onConflictDoUpdate({
        target: products.id,
        set: {
          name: product.name,
          description: product.description,
          uom: product.uom,
          countryOfOrigin: product.countryOfOrigin,
          material: product.material,
          length: product.length,
          width: product.width,
          height: product.height,
          diameter: product.diameter,
          size: product.size,
          weight: product.weight,
          weightUom: product.weightUom,
          memberPriceCents: product.memberPrice.amountMinor,
          listPriceCents: product.listPrice?.amountMinor ?? null,
          originalWholesalePriceCents: product.originalWholesalePrice?.amountMinor ?? null,
          currency: product.memberPrice.currency,
          catalogPage: product.catalogPage,
          defaultOrderQty: product.defaultOrderQty,
          defaultWeight: product.defaultWeight,
          defaultWeightUom: product.defaultWeightUom,
          inactive: product.inactive,
          discontinued: product.discontinued,
          nonStock: product.nonStock,
          noExport: product.noExport,
          webWholesale: product.webWholesale,
          webRetail: product.webRetail,
          taxCategoryCode: product.taxCategoryCode,
          updatedAt: new Date(),
        },
      });
  }

  async saveMany(productsList: readonly Product[]): Promise<void> {
    if (productsList.length === 0) {
      return;
    }
    await this.db
      .insert(products)
      .values(productsList.map((product) => productToInsertRow(product)))
      .onConflictDoUpdate({
        target: products.id,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          uom: sql`excluded.uom`,
          countryOfOrigin: sql`excluded.country_of_origin`,
          material: sql`excluded.material`,
          length: sql`excluded.length`,
          width: sql`excluded.width`,
          height: sql`excluded.height`,
          diameter: sql`excluded.diameter`,
          size: sql`excluded.size`,
          weight: sql`excluded.weight`,
          weightUom: sql`excluded.weight_uom`,
          memberPriceCents: sql`excluded.member_price_cents`,
          listPriceCents: sql`excluded.list_price_cents`,
          originalWholesalePriceCents: sql`excluded.original_wholesale_price_cents`,
          currency: sql`excluded.currency`,
          catalogPage: sql`excluded.catalog_page`,
          defaultOrderQty: sql`excluded.default_order_qty`,
          defaultWeight: sql`excluded.default_weight`,
          defaultWeightUom: sql`excluded.default_weight_uom`,
          inactive: sql`excluded.inactive`,
          discontinued: sql`excluded.discontinued`,
          nonStock: sql`excluded.non_stock`,
          noExport: sql`excluded.no_export`,
          webWholesale: sql`excluded.web_wholesale`,
          webRetail: sql`excluded.web_retail`,
          taxCategoryCode: sql`excluded.tax_category_code`,
          updatedAt: new Date(),
        },
      });
  }
}
