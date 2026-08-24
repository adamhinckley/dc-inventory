import { SupplierId } from "@dc-inventory/shared-kernel";
import { eq } from "drizzle-orm";
import type { ISupplierRepository } from "../domain/ports/purchase-order-repository.js";
import type { Supplier } from "../domain/supplier.js";
import { suppliers } from "../persistence/schema.js";
import type { PurchasingDrizzle } from "./drizzle-purchase-orders.js";

function toSupplier(row: typeof suppliers.$inferSelect): Supplier {
  return {
    id: SupplierId.parse(row.id),
    vendorNumber: row.vendorNumber,
    name: row.name,
  };
}

export class DrizzleSupplierRepository implements ISupplierRepository {
  constructor(private readonly db: PurchasingDrizzle) {}

  async findById(id: SupplierId): Promise<Supplier | null> {
    const rows = await this.db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    return rows[0] === undefined ? null : toSupplier(rows[0]);
  }

  async findByVendorNumber(vendorNumber: string): Promise<Supplier | null> {
    const rows = await this.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.vendorNumber, vendorNumber))
      .limit(1);
    return rows[0] === undefined ? null : toSupplier(rows[0]);
  }

  async save(supplier: Supplier): Promise<void> {
    const existing = await this.findById(supplier.id);
    if (existing === null) {
      await this.db.insert(suppliers).values({
        id: supplier.id,
        vendorNumber: supplier.vendorNumber,
        name: supplier.name,
      });
      return;
    }
    await this.db
      .update(suppliers)
      .set({
        vendorNumber: supplier.vendorNumber,
        name: supplier.name,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, supplier.id));
  }
}
