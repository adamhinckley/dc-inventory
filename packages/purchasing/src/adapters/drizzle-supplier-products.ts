import { Sku, SupplierId } from "@dc-inventory/shared-kernel";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { SupplierProductId } from "../domain/ids.js";
import type {
  ISupplierProductRepository,
  ListSupplierProductsQuery,
  SupplierProductListPage,
} from "../domain/ports/supplier-product-repository.js";
import type { SupplierProduct } from "../domain/supplier-product.js";
import { supplierProducts } from "../persistence/schema.js";
import type { PurchasingDrizzle } from "./drizzle-purchase-orders.js";

function toSupplierProduct(row: typeof supplierProducts.$inferSelect): SupplierProduct {
  return {
    id: SupplierProductId.parse(row.id),
    supplierId: SupplierId.parse(row.supplierId),
    sku: Sku.parse(row.sku),
    supplierSku: row.supplierSku,
    minOrderQty: row.minOrderQty,
    minOrderAmountCents: row.minOrderAmountCents,
    lastPoCostCents: row.lastPoCostCents,
    currency: row.currency,
  };
}

export class DrizzleSupplierProductRepository implements ISupplierProductRepository {
  constructor(private readonly db: PurchasingDrizzle) {}

  async listBySupplier(query: ListSupplierProductsQuery): Promise<SupplierProductListPage> {
    const clauses = [eq(supplierProducts.supplierId, query.supplierId)];
    const needle = query.q?.trim() ?? "";
    if (needle.length > 0) {
      const pattern = `%${needle}%`;
      clauses.push(
        or(ilike(supplierProducts.sku, pattern), ilike(supplierProducts.supplierSku, pattern))!,
      );
    }
    const where = and(...clauses);
    const offset = (query.page - 1) * query.pageSize;
    const sortColumn =
      query.sortBy === "supplierSku" ? supplierProducts.supplierSku : supplierProducts.sku;
    const order = query.sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn);
    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(supplierProducts)
        .where(where)
        .orderBy(order)
        .limit(query.pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(supplierProducts)
        .where(where),
    ]);
    return {
      items: rows.map(toSupplierProduct),
      total: countRows[0]?.count ?? 0,
    };
  }

  async findById(
    supplierId: SupplierId,
    id: SupplierProductId,
  ): Promise<SupplierProduct | null> {
    const rows = await this.db
      .select()
      .from(supplierProducts)
      .where(and(eq(supplierProducts.id, id), eq(supplierProducts.supplierId, supplierId)))
      .limit(1);
    return rows[0] === undefined ? null : toSupplierProduct(rows[0]);
  }

  async findBySupplierAndSku(
    supplierId: SupplierId,
    sku: Sku,
  ): Promise<SupplierProduct | null> {
    const rows = await this.db
      .select()
      .from(supplierProducts)
      .where(
        and(eq(supplierProducts.supplierId, supplierId), eq(supplierProducts.sku, sku.value)),
      )
      .limit(1);
    return rows[0] === undefined ? null : toSupplierProduct(rows[0]);
  }

  async listBySupplierIds(supplierIds: readonly SupplierId[]): Promise<readonly SupplierProduct[]> {
    if (supplierIds.length === 0) {
      return [];
    }
    const rows = await this.db
      .select()
      .from(supplierProducts)
      .where(inArray(supplierProducts.supplierId, [...supplierIds]));
    return rows.map(toSupplierProduct);
  }

  async save(product: SupplierProduct): Promise<void> {
    const existing = await this.findById(product.supplierId, product.id);
    if (existing === null) {
      await this.db.insert(supplierProducts).values({
        id: product.id,
        supplierId: product.supplierId,
        sku: product.sku.value,
        supplierSku: product.supplierSku,
        minOrderQty: product.minOrderQty,
        minOrderAmountCents: product.minOrderAmountCents,
        lastPoCostCents: product.lastPoCostCents,
        currency: product.currency,
      });
      return;
    }
    await this.db
      .update(supplierProducts)
      .set({
        supplierSku: product.supplierSku,
        minOrderQty: product.minOrderQty,
        minOrderAmountCents: product.minOrderAmountCents,
        lastPoCostCents: product.lastPoCostCents,
        currency: product.currency,
        updatedAt: new Date(),
      })
      .where(eq(supplierProducts.id, product.id));
  }

  async saveMany(products: readonly SupplierProduct[]): Promise<void> {
    if (products.length === 0) {
      return;
    }
    await this.db
      .insert(supplierProducts)
      .values(
        products.map((product) => ({
          id: product.id,
          supplierId: product.supplierId,
          sku: product.sku.value,
          supplierSku: product.supplierSku,
          minOrderQty: product.minOrderQty,
          minOrderAmountCents: product.minOrderAmountCents,
          lastPoCostCents: product.lastPoCostCents,
          currency: product.currency,
        })),
      )
      .onConflictDoUpdate({
        target: [supplierProducts.supplierId, supplierProducts.sku],
        set: {
          supplierSku: sql`excluded.supplier_sku`,
          minOrderQty: sql`excluded.min_order_qty`,
          minOrderAmountCents: sql`excluded.min_order_amount_cents`,
          lastPoCostCents: sql`excluded.last_po_cost_cents`,
          currency: sql`excluded.currency`,
          updatedAt: new Date(),
        },
      });
  }

  async delete(supplierId: SupplierId, id: SupplierProductId): Promise<boolean> {
    const existing = await this.findById(supplierId, id);
    if (existing === null) {
      return false;
    }
    await this.db
      .delete(supplierProducts)
      .where(and(eq(supplierProducts.id, id), eq(supplierProducts.supplierId, supplierId)));
    return true;
  }
}
