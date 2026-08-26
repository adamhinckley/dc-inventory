import { OrganizationId, SupplierId } from "@dc-inventory/shared-kernel";
import { and, eq } from "drizzle-orm";
import type { ISupplierRepository } from "../domain/ports/purchase-order-repository.js";
import type { Supplier } from "../domain/supplier.js";
import { suppliers } from "../persistence/schema.js";
import type { PurchasingDrizzle } from "./drizzle-purchase-orders.js";

function toSupplier(row: typeof suppliers.$inferSelect): Supplier {
  return {
    id: SupplierId.parse(row.id),
    organizationId: OrganizationId.parse(row.organizationId),
    vendorNumber: row.vendorNumber,
    name: row.name,
  };
}

export class DrizzleSupplierRepository implements ISupplierRepository {
  constructor(private readonly db: PurchasingDrizzle) {}

  async findById(organizationId: OrganizationId, id: SupplierId): Promise<Supplier | null> {
    const rows = await this.db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, id), eq(suppliers.organizationId, organizationId)))
      .limit(1);
    return rows[0] === undefined ? null : toSupplier(rows[0]);
  }

  async findByVendorNumber(
    organizationId: OrganizationId,
    vendorNumber: string,
  ): Promise<Supplier | null> {
    const rows = await this.db
      .select()
      .from(suppliers)
      .where(
        and(eq(suppliers.organizationId, organizationId), eq(suppliers.vendorNumber, vendorNumber)),
      )
      .limit(1);
    return rows[0] === undefined ? null : toSupplier(rows[0]);
  }

  async save(supplier: Supplier): Promise<void> {
    const existing = await this.findById(supplier.organizationId, supplier.id);
    if (existing === null) {
      await this.db.insert(suppliers).values({
        id: supplier.id,
        organizationId: supplier.organizationId,
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
