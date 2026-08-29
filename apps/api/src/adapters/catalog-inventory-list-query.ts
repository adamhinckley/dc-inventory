import {
  type CatalogListQuery,
  type ICatalogListQuery,
  type Product,
  type ProductQty,
} from "@dc-inventory/catalog";
import { products } from "@dc-inventory/catalog/schema";
import { locations, stockSnapshots } from "@dc-inventory/inventory/schema";
import { Money, OrganizationId, ProductId, Sku } from "@dc-inventory/shared-kernel";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { AppDrizzle } from "../infrastructure/db.js";

const DEFAULT_LOCATION_CODE = "DEFAULT";

function productFromRow(row: {
  id: string;
  organizationId: string;
  sku: string;
  name: string;
  description: string | null;
  uom: string;
  memberPriceCents: number;
  currency: string;
  inactive: boolean;
  discontinued: boolean;
  webWholesale: boolean;
  taxCategoryCode: string | null;
}): Product {
  return {
    id: ProductId.parse(row.id),
    organizationId: OrganizationId.parse(row.organizationId),
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

/**
 * Dedicated Catalog plus Inventory list projection.
 *
 * Inventory's movement-derived snapshot remains the only source of quantity.
 * The adapter only reads that projection for filtering, ordering, and paging.
 */
export class CatalogInventoryListQuery implements ICatalogListQuery {
  constructor(private readonly db: AppDrizzle) {}

  async list(query: CatalogListQuery) {
    const clauses = [eq(products.organizationId, query.organizationId)];
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
      clauses.push(or(ilike(products.sku, pattern), ilike(products.name, pattern))!);
    }
    const where = and(...clauses);
    const onHand = sql<number>`coalesce(${stockSnapshots.onHand}, 0)`;
    const onOrder = sql<number>`coalesce(${stockSnapshots.onOrder}, 0)`;
    const allocated = sql<number>`coalesce(${stockSnapshots.allocated}, 0)`;
    const available = sql<number>`coalesce(${stockSnapshots.available}, 0)`;
    const sortExpression =
      query.sortBy === "sku"
        ? products.sku
        : query.sortBy === "name"
          ? products.name
          : query.sortBy === "onHand"
            ? onHand
            : query.sortBy === "available"
              ? available
              : products.createdAt;
    const direction = query.sortOrder === "desc" ? desc : asc;
    const offset = (query.page - 1) * query.pageSize;

    const [totalRows, rows] = await Promise.all([
      this.db.select({ value: count() }).from(products).where(where),
      this.db
        .select({
          id: products.id,
          organizationId: products.organizationId,
          sku: products.sku,
          name: products.name,
          description: products.description,
          uom: products.uom,
          memberPriceCents: products.memberPriceCents,
          currency: products.currency,
          inactive: products.inactive,
          discontinued: products.discontinued,
          webWholesale: products.webWholesale,
          taxCategoryCode: products.taxCategoryCode,
          createdAt: products.createdAt,
          onHand,
          onOrder,
          allocated,
          available,
        })
        .from(products)
        .leftJoin(
          locations,
          and(
            eq(locations.organizationId, products.organizationId),
            eq(locations.code, DEFAULT_LOCATION_CODE),
          ),
        )
        .leftJoin(
          stockSnapshots,
          and(
            eq(stockSnapshots.organizationId, products.organizationId),
            eq(stockSnapshots.sku, products.sku),
            eq(stockSnapshots.locationId, locations.id),
          ),
        )
        .where(where)
        .orderBy(direction(sortExpression), asc(products.id))
        .limit(query.pageSize)
        .offset(offset),
    ]);

    return {
      items: rows.map((row) => ({
        product: productFromRow(row),
        qty: {
          onHand: row.onHand,
          onOrder: row.onOrder,
          allocated: row.allocated,
          available: row.available,
        } satisfies ProductQty,
        createdAt: row.createdAt,
      })),
      total: totalRows[0]?.value ?? 0,
    };
  }
}
