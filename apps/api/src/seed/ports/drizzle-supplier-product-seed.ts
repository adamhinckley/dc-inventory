import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { supplierProducts } from "@dc-inventory/purchasing/schema";
import type {
  ISupplierProductSeedRepository,
  SupplierProductSeedRow,
} from "./static-seed-types.js";

export type PurchasingSupplierProductDrizzle = PostgresJsDatabase<{
  supplierProducts: typeof supplierProducts;
}>;

export class DrizzleSupplierProductSeedRepository implements ISupplierProductSeedRepository {
  constructor(private readonly db: PurchasingSupplierProductDrizzle) {}

  async save(row: SupplierProductSeedRow): Promise<void> {
    const existing = await this.db
      .select({ id: supplierProducts.id })
      .from(supplierProducts)
      .where(
        and(
          eq(supplierProducts.supplierId, row.supplierId),
          eq(supplierProducts.sku, row.sku),
        ),
      )
      .limit(1);
    if (existing[0] !== undefined) {
      await this.db
        .update(supplierProducts)
        .set({
          minOrderQty: row.minOrderQty,
          updatedAt: new Date(),
        })
        .where(eq(supplierProducts.id, existing[0].id));
      return;
    }
    await this.db.insert(supplierProducts).values({
      supplierId: row.supplierId,
      sku: row.sku,
      minOrderQty: row.minOrderQty,
    });
  }

  async listAll(): Promise<readonly SupplierProductSeedRow[]> {
    const rows = await this.db
      .select({
        supplierId: supplierProducts.supplierId,
        sku: supplierProducts.sku,
        minOrderQty: supplierProducts.minOrderQty,
      })
      .from(supplierProducts);
    return rows.map((row) => ({
      supplierId: row.supplierId,
      sku: row.sku,
      minOrderQty: row.minOrderQty,
    }));
  }
}
