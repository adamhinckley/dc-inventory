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

function rowToPackaging(row: typeof productPackaging.$inferSelect): ProductPackaging {
  return {
    productId: ProductId.parse(row.productId),
    packLength: row.packLength,
    packWidth: row.packWidth,
    packHeight: row.packHeight,
    packWeight: row.packWeight,
    packWeightUom: row.packWeightUom,
    innerPackQty: row.innerPackQty,
    innerPackLength: row.innerPackLength,
    innerPackWidth: row.innerPackWidth,
    innerPackHeight: row.innerPackHeight,
    innerPackWeight: row.innerPackWeight,
    innerPackWeightUom: row.innerPackWeightUom,
    caseQty: row.caseQty,
    caseLength: row.caseLength,
    caseWidth: row.caseWidth,
    caseHeight: row.caseHeight,
    caseWeight: row.caseWeight,
    caseWeightUom: row.caseWeightUom,
  };
}

function packagingToInsertRow(packaging: ProductPackaging): typeof productPackaging.$inferInsert {
  return {
    id: newUuid(),
    productId: packaging.productId,
    packLength: packaging.packLength,
    packWidth: packaging.packWidth,
    packHeight: packaging.packHeight,
    packWeight: packaging.packWeight,
    packWeightUom: packaging.packWeightUom,
    innerPackQty: packaging.innerPackQty,
    innerPackLength: packaging.innerPackLength,
    innerPackWidth: packaging.innerPackWidth,
    innerPackHeight: packaging.innerPackHeight,
    innerPackWeight: packaging.innerPackWeight,
    innerPackWeightUom: packaging.innerPackWeightUom,
    caseQty: packaging.caseQty,
    caseLength: packaging.caseLength,
    caseWidth: packaging.caseWidth,
    caseHeight: packaging.caseHeight,
    caseWeight: packaging.caseWeight,
    caseWeightUom: packaging.caseWeightUom,
  };
}

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
    return rowToPackaging(row);
  }

  async save(packaging: ProductPackaging): Promise<void> {
    await this.db
      .insert(productPackaging)
      .values(packagingToInsertRow(packaging))
      .onConflictDoUpdate({
        target: productPackaging.productId,
        set: {
          packLength: packaging.packLength,
          packWidth: packaging.packWidth,
          packHeight: packaging.packHeight,
          packWeight: packaging.packWeight,
          packWeightUom: packaging.packWeightUom,
          innerPackQty: packaging.innerPackQty,
          innerPackLength: packaging.innerPackLength,
          innerPackWidth: packaging.innerPackWidth,
          innerPackHeight: packaging.innerPackHeight,
          innerPackWeight: packaging.innerPackWeight,
          innerPackWeightUom: packaging.innerPackWeightUom,
          caseQty: packaging.caseQty,
          caseLength: packaging.caseLength,
          caseWidth: packaging.caseWidth,
          caseHeight: packaging.caseHeight,
          caseWeight: packaging.caseWeight,
          caseWeightUom: packaging.caseWeightUom,
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
      .values(packagingList.map((packaging) => packagingToInsertRow(packaging)))
      .onConflictDoUpdate({
        target: productPackaging.productId,
        set: {
          packLength: sql`excluded.pack_length`,
          packWidth: sql`excluded.pack_width`,
          packHeight: sql`excluded.pack_height`,
          packWeight: sql`excluded.pack_weight`,
          packWeightUom: sql`excluded.pack_weight_uom`,
          innerPackQty: sql`excluded.inner_pack_qty`,
          innerPackLength: sql`excluded.inner_pack_length`,
          innerPackWidth: sql`excluded.inner_pack_width`,
          innerPackHeight: sql`excluded.inner_pack_height`,
          innerPackWeight: sql`excluded.inner_pack_weight`,
          innerPackWeightUom: sql`excluded.inner_pack_weight_uom`,
          caseQty: sql`excluded.case_qty`,
          caseLength: sql`excluded.case_length`,
          caseWidth: sql`excluded.case_width`,
          caseHeight: sql`excluded.case_height`,
          caseWeight: sql`excluded.case_weight`,
          caseWeightUom: sql`excluded.case_weight_uom`,
          updatedAt: new Date(),
        },
      });
  }
}
