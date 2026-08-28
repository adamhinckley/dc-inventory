import { ProductId } from "@dc-inventory/shared-kernel";
import { eq } from "drizzle-orm";
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
    };
  }

  async save(packaging: ProductPackaging): Promise<void> {
    await this.db
      .insert(productPackaging)
      .values({
        id: newUuid(),
        productId: packaging.productId,
        caseQty: packaging.caseQty,
      })
      .onConflictDoUpdate({
        target: productPackaging.productId,
        set: {
          caseQty: packaging.caseQty,
          updatedAt: new Date(),
        },
      });
  }
}
