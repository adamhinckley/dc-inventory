import { Money, ProductId, Sku } from "@dc-inventory/shared-kernel";
import { and, eq, ilike, or } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Product } from "../domain/product.js";
import type {
  IProductRepository,
  ListedProduct,
  ProductListMatch,
} from "../domain/ports/product-repository.js";
import { products } from "../persistence/schema.js";

export type CatalogDrizzle = PostgresJsDatabase<{
  products: typeof products;
}>;

function toProduct(row: typeof products.$inferSelect): Product {
  return {
    id: ProductId.parse(row.id),
    sku: Sku.parse(row.sku),
    name: row.name,
    description: row.description,
    uom: row.uom,
    memberPrice: Money.fromMinorUnits(row.memberPriceCents, row.currency),
    inactive: row.inactive,
    discontinued: row.discontinued,
    webWholesale: row.webWholesale,
    taxCategoryCode: row.taxCategoryCode,
  };
}

export class DrizzleProductRepository implements IProductRepository {
  constructor(private readonly db: CatalogDrizzle) {}

  async listMatching(query: ProductListMatch): Promise<ListedProduct[]> {
    const clauses = [];
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
      clauses.push(or(ilike(products.sku, pattern), ilike(products.name, pattern)));
    }
    const where = clauses.length === 0 ? undefined : and(...clauses);
    const rows = await this.db.select().from(products).where(where);
    return rows.map((row) => ({
      product: toProduct(row),
      createdAt: row.createdAt,
    }));
  }

  async findById(id: ProductId): Promise<Product | null> {
    const rows = await this.db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    return rows[0] === undefined ? null : toProduct(rows[0]);
  }

  async findBySku(sku: Sku): Promise<Product | null> {
    const rows = await this.db
      .select()
      .from(products)
      .where(eq(products.sku, sku.value))
      .limit(1);
    return rows[0] === undefined ? null : toProduct(rows[0]);
  }

  async save(product: Product): Promise<void> {
    await this.db
      .insert(products)
      .values({
        id: product.id,
        sku: product.sku.value,
        name: product.name,
        description: product.description,
        uom: product.uom,
        memberPriceCents: product.memberPrice.amountMinor,
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
