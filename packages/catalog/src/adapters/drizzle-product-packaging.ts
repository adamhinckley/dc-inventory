import { ProductId } from "@dc-inventory/shared-kernel";
import { eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { newUuid } from "../domain/ids.js";
import type {
  IProductPackagingRepository,
  ProductPackaging,
} from "../domain/ports/product-packaging.js";
import { productPackaging, products } from "../persistence/schema.js";

export type CatalogPackagingDrizzle = PostgresJsDatabase<{
  products: typeof products;
  productPackaging: typeof productPackaging;
}>;

export class DrizzleProductPackagingRepository implements IProductPackagingRepository {
  constructor(private readonly db: CatalogPackagingDrizzle) {}

  async findByProductId(productId: ProductId): Promise<ProductPackaging | null> {
    const rows = await this.db
      .select()
      .from(productPackaging)
      .where(eq(productPackaging.productId, productId))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      productId: ProductId.parse(row.productId),
      caseQty: row.caseQty,
      caseLength: row.caseLength,
      caseWidth: row.caseWidth,
      caseHeight: row.caseHeight,
    };
  }

  async save(packaging: ProductPackaging): Promise<void> {
    await this.db
      .insert(productPackaging)
      .values({
        id: newUuid(),
        productId: packaging.productId,
        caseQty: packaging.caseQty,
        caseLength: packaging.caseLength,
        caseWidth: packaging.caseWidth,
        caseHeight: packaging.caseHeight,
      })
      .onConflictDoUpdate({
        target: productPackaging.productId,
        set: {
          caseQty: packaging.caseQty,
          caseLength: packaging.caseLength,
          caseWidth: packaging.caseWidth,
          caseHeight: packaging.caseHeight,
          updatedAt: new Date(),
        },
      });
  }

  async saveMany(packagingList: readonly ProductPackaging[]): Promise<void> {
    if (packagingList.length === 0) {
      return;
    }
    await this.db
      .insert(productPackaging)
      .values(
        packagingList.map((packaging) => ({
          id: newUuid(),
          productId: packaging.productId,
          caseQty: packaging.caseQty,
          caseLength: packaging.caseLength,
          caseWidth: packaging.caseWidth,
          caseHeight: packaging.caseHeight,
        })),
      )
      .onConflictDoUpdate({
        target: productPackaging.productId,
        set: {
          caseQty: sql`excluded.case_qty`,
          caseLength: sql`excluded.case_length`,
          caseWidth: sql`excluded.case_width`,
          caseHeight: sql`excluded.case_height`,
          updatedAt: new Date(),
        },
      });
  }
}
