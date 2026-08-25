import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { productImages } from "@dc-inventory/catalog/schema";
import type { IProductImageSeedRepository, ProductImageSeedRow } from "./static-seed-types.js";

export type CatalogImageDrizzle = PostgresJsDatabase<{
  productImages: typeof productImages;
}>;

export class DrizzleProductImageSeedRepository implements IProductImageSeedRepository {
  constructor(private readonly db: CatalogImageDrizzle) {}

  async save(row: ProductImageSeedRow): Promise<void> {
    const existing = await this.db
      .select({ id: productImages.id })
      .from(productImages)
      .where(eq(productImages.productId, row.productId))
      .limit(1);
    if (existing[0] !== undefined) {
      await this.db
        .update(productImages)
        .set({
          objectKey: row.objectKey,
          contentType: row.contentType,
          updatedAt: new Date(),
        })
        .where(eq(productImages.productId, row.productId));
      return;
    }
    await this.db.insert(productImages).values({
      productId: row.productId,
      objectKey: row.objectKey,
      contentType: row.contentType,
    });
  }

  async listAll(): Promise<readonly ProductImageSeedRow[]> {
    const rows = await this.db
      .select({
        productId: productImages.productId,
        objectKey: productImages.objectKey,
        contentType: productImages.contentType,
      })
      .from(productImages);
    return rows.map((row) => ({
      productId: row.productId,
      objectKey: row.objectKey,
      contentType: row.contentType ?? "",
    }));
  }
}
