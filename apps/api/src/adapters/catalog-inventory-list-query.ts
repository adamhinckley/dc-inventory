import {
  type CatalogListQuery,
  type ICatalogListQuery,
  type Product,
  type ProductQty,
} from "@dc-inventory/catalog";
import type { IClock } from "@dc-inventory/inventory";
import {
  categories,
  productCategories,
  productPackaging,
  products,
} from "@dc-inventory/catalog/schema";
import { locations, stockSnapshots } from "@dc-inventory/inventory/schema";
import { Money, OrganizationId, ProductId, Sku } from "@dc-inventory/shared-kernel";
import { and, asc, count, desc, eq, gt, ilike, inArray, or, sql } from "drizzle-orm";
import type { AppDrizzle } from "../infrastructure/db.js";
import { productQtyFromSnapshotRow } from "./product-qty-from-snapshot.js";

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
  constructor(
    private readonly db: AppDrizzle,
    private readonly clock?: IClock,
  ) {}

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
    const category = query.category?.trim() ?? "";
    if (category.length > 0) {
      const productIds = this.db
        .select({ productId: productCategories.productId })
        .from(productCategories)
        .innerJoin(categories, eq(categories.id, productCategories.categoryId))
        .where(
          and(
            eq(categories.organizationId, query.organizationId),
            eq(categories.name, category),
          ),
        );
      clauses.push(inArray(products.id, productIds));
    }
    const onHand = sql<number>`coalesce(${stockSnapshots.onHand}, 0)`;
    const onOrder = sql<number>`coalesce(${stockSnapshots.onOrder}, 0)`;
    const allocated = sql<number>`coalesce(${stockSnapshots.allocated}, 0)`;
    const available = sql<number>`coalesce(${stockSnapshots.available}, 0)`;
    const committed = sql<number>`coalesce(${stockSnapshots.committed}, 0)`;
    if (query.hideZeroInventory === true) {
      clauses.push(or(gt(onHand, 0), gt(onOrder, 0), gt(allocated, 0), gt(committed, 0))!);
    }
    const where = and(...clauses);
    const stickyLocked = sql<boolean>`coalesce(${stockSnapshots.stickyLocked}, false)`;
    const caseQty = sql<number>`coalesce(${productPackaging.caseQty}, 0)`;
    const now = this.clock ? this.clock.now() : new Date();
    const isLockedForSell = sql<boolean>`(
      ${stickyLocked}
      OR (${stockSnapshots.windowOpensAt} IS NOT NULL AND ${stockSnapshots.windowOpensAt} > ${now})
      OR (${stockSnapshots.windowClosesAt} IS NOT NULL AND ${stockSnapshots.windowClosesAt} <= ${now})
    )`;
    const availableToSellSort = sql<number | null>`CASE
      WHEN ${isLockedForSell} THEN ${onHand} + ${onOrder} - ${committed}
      ELSE NULL
    END`;
    const direction = query.sortOrder === "desc" ? desc : asc;
    const tieBreak = asc(products.id);
    const orderBy =
      query.sortBy === "sku"
        ? [direction(products.sku), tieBreak]
        : query.sortBy === "name"
          ? [direction(products.name), tieBreak]
          : query.sortBy === "onHand"
            ? [direction(onHand), tieBreak]
            : query.sortBy === "onOrder"
              ? [direction(onOrder), tieBreak]
              : query.sortBy === "allocated"
                ? [direction(allocated), tieBreak]
                : query.sortBy === "available"
                  ? [direction(available), tieBreak]
                  : query.sortBy === "committed"
                    ? [direction(committed), tieBreak]
                    : query.sortBy === "sellState"
                      ? [direction(isLockedForSell), tieBreak]
                      : query.sortBy === "availableToSell"
                        ? query.sortOrder === "desc"
                          ? [sql`${availableToSellSort} DESC NULLS FIRST`, tieBreak]
                          : [sql`${availableToSellSort} ASC NULLS LAST`, tieBreak]
                        : query.sortBy === "caseQty"
                          ? [direction(caseQty), tieBreak]
                          : [direction(products.createdAt), tieBreak];
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
          committed,
          stickyLocked,
          windowOpensAt: stockSnapshots.windowOpensAt,
          windowClosesAt: stockSnapshots.windowClosesAt,
          caseQty: productPackaging.caseQty,
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
        .leftJoin(productPackaging, eq(productPackaging.productId, products.id))
        .where(where)
        .orderBy(...orderBy)
        .limit(query.pageSize)
        .offset(offset),
    ]);

    return {
      items: rows.map((row) => ({
        product: productFromRow(row),
        qty: productQtyFromSnapshotRow(
          {
            onHand: row.onHand,
            onOrder: row.onOrder,
            allocated: row.allocated,
            committed: row.committed,
            stickyLocked: row.stickyLocked,
            windowOpensAt: row.windowOpensAt,
            windowClosesAt: row.windowClosesAt,
          },
          now,
        ) satisfies ProductQty,
        createdAt: row.createdAt,
        caseQty: row.caseQty ?? null,
      })),
      total: totalRows[0]?.value ?? 0,
    };
  }
}
