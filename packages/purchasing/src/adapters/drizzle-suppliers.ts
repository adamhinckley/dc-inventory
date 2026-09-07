import { OrganizationId, SupplierId } from "@dc-inventory/shared-kernel";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type {
  ISupplierRepository,
  ListSuppliersQuery,
  SupplierListPage,
} from "../domain/ports/purchase-order-repository.js";
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

  async list(query: ListSuppliersQuery): Promise<SupplierListPage> {
    const clauses = [eq(suppliers.organizationId, query.organizationId)];
    if (query.q !== undefined && query.q.trim().length > 0) {
      const pattern = `%${query.q.trim()}%`;
      clauses.push(or(ilike(suppliers.vendorNumber, pattern), ilike(suppliers.name, pattern))!);
    }
    const where = and(...clauses);
    const offset = (query.page - 1) * query.pageSize;
    const sortColumn = query.sortBy === "name" ? suppliers.name : suppliers.vendorNumber;
    const order = query.sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn);
    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(suppliers)
        .where(where)
        .orderBy(order)
        .limit(query.pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(suppliers)
        .where(where),
    ]);
    return {
      items: rows.map(toSupplier),
      total: countRows[0]?.count ?? 0,
    };
  }

  async findById(organizationId: OrganizationId, id: SupplierId): Promise<Supplier | null> {
    const rows = await this.db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, id), eq(suppliers.organizationId, organizationId)))
      .limit(1);
    return rows[0] === undefined ? null : toSupplier(rows[0]);
  }

  async findByIds(
    organizationId: OrganizationId,
    ids: readonly SupplierId[],
  ): Promise<ReadonlyMap<string, Supplier>> {
    const result = new Map<string, Supplier>();
    if (ids.length === 0) {
      return result;
    }
    const rows = await this.db
      .select()
      .from(suppliers)
      .where(
        and(
          eq(suppliers.organizationId, organizationId),
          inArray(suppliers.id, [...ids]),
        ),
      );
    for (const row of rows) {
      const supplier = toSupplier(row);
      result.set(supplier.id, supplier);
    }
    return result;
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

  async findByVendorNumbers(
    organizationId: OrganizationId,
    vendorNumbers: readonly string[],
  ): Promise<ReadonlyMap<string, Supplier>> {
    const result = new Map<string, Supplier>();
    if (vendorNumbers.length === 0) {
      return result;
    }
    const rows = await this.db
      .select()
      .from(suppliers)
      .where(
        and(
          eq(suppliers.organizationId, organizationId),
          inArray(suppliers.vendorNumber, [...vendorNumbers]),
        ),
      );
    for (const row of rows) {
      const supplier = toSupplier(row);
      result.set(supplier.vendorNumber, supplier);
    }
    return result;
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
