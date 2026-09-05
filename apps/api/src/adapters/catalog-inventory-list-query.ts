import {
  type CatalogListQuery,
  type ICatalogListQuery,
  type Product,
  type ProductQty,
} from "@dc-inventory/catalog";
import {
  isShopSellableSql,
  staffCatalogAvailableToSellOrderBySql,
  staffCatalogDemandProjectionSql,
  type IClock,
} from "@dc-inventory/inventory";
import {
  categories,
  productCategories,
  productPackaging,
  products,
} from "@dc-inventory/catalog/schema";
import { locations, stockSnapshots } from "@dc-inventory/inventory/schema";
import { supplierProducts, suppliers } from "@dc-inventory/purchasing/schema";
import { Money, OrganizationId, ProductId, Sku } from "@dc-inventory/shared-kernel";
import { and, asc, count, desc, eq, gt, ilike, inArray, or, sql } from "drizzle-orm";
import type { AppDrizzle } from "../infrastructure/db.js";
import { normalizeCents } from "./normalize-cents.js";
import { productQtyFromSnapshotRow } from "./product-qty-from-snapshot.js";

const DEFAULT_LOCATION_CODE = "DEFAULT";

const lastPoCostCents = sql<number | null>`(
  select ${supplierProducts.lastPoCostCents}
  from ${supplierProducts}
  inner join ${suppliers} on ${suppliers.id} = ${supplierProducts.supplierId}
  where ${supplierProducts.sku} = ${products.sku}
    and ${suppliers.organizationId} = ${products.organizationId}
    and ${supplierProducts.lastPoCostCents} is not null
  order by ${supplierProducts.updatedAt} desc
  limit 1
)`;

const supplierName = sql<string | null>`(
  select string_agg(${suppliers.name}, ', ' order by ${suppliers.name})
  from ${supplierProducts}
  inner join ${suppliers} on ${suppliers.id} = ${supplierProducts.supplierId}
  where ${supplierProducts.sku} = ${products.sku}
    and ${suppliers.organizationId} = ${products.organizationId}
)`;

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
  listPriceCents: number | null;
}): Product {
  return {
    id: ProductId.parse(row.id),
    organizationId: OrganizationId.parse(row.organizationId),
    sku: Sku.parse(row.sku),
    name: row.name,
    description: row.description,
    uom: row.uom,
    memberPrice: Money.fromMinorUnits(row.memberPriceCents, row.currency),
    listPrice:
      row.listPriceCents === null
        ? null
        : Money.fromMinorUnits(row.listPriceCents, row.currency),
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
    const categoryNames = (query.category ?? [])
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    if (categoryNames.length > 0) {
      const productIds = this.db
        .select({ productId: productCategories.productId })
        .from(productCategories)
        .innerJoin(categories, eq(categories.id, productCategories.categoryId))
        .where(
          and(
            eq(categories.organizationId, query.organizationId),
            inArray(categories.name, categoryNames),
          ),
        );
      clauses.push(inArray(products.id, productIds));
    }
    const supplierIds = (query.supplierId ?? [])
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    if (supplierIds.length > 0) {
      const factorySkus = this.db
        .select({ sku: supplierProducts.sku })
        .from(supplierProducts)
        .innerJoin(suppliers, eq(suppliers.id, supplierProducts.supplierId))
        .where(
          and(
            eq(suppliers.organizationId, query.organizationId),
            inArray(supplierProducts.supplierId, supplierIds),
          ),
        );
      clauses.push(inArray(products.sku, factorySkus));
    }
    const onHand = sql<number>`coalesce(${stockSnapshots.onHand}, 0)`;
    const onOrder = sql<number>`coalesce(${stockSnapshots.onOrder}, 0)`;
    const allocated = sql<number>`coalesce(${stockSnapshots.allocated}, 0)`;
    const available = sql<number>`${onHand} - ${allocated}`;
    const committed = sql<number>`coalesce(${stockSnapshots.committed}, 0)`;
    const stickyLocked = sql<boolean>`coalesce(${stockSnapshots.stickyLocked}, false)`;
    const now = this.clock ? this.clock.now() : new Date();
    const nowIso = now.toISOString();
    const demandProjectionColumns = {
      onHand: stockSnapshots.onHand,
      onOrder: stockSnapshots.onOrder,
      committed: stockSnapshots.committed,
      stickyLocked: stockSnapshots.stickyLocked,
      windowOpensAt: stockSnapshots.windowOpensAt,
      windowClosesAt: stockSnapshots.windowClosesAt,
    };
    const demandProjection = staffCatalogDemandProjectionSql(demandProjectionColumns, nowIso);
    if (query.hideZeroInventory === true) {
      clauses.push(or(gt(onHand, 0), gt(onOrder, 0), gt(allocated, 0), gt(committed, 0))!);
    }
    if (query.availableOnly === true) {
      clauses.push(isShopSellableSql(available, demandProjectionColumns, nowIso));
    }
    if (query.sellState === "locked") {
      clauses.push(sql`${demandProjection.isLockedForSell} = true`);
    } else if (query.sellState === "open") {
      clauses.push(sql`${demandProjection.isLockedForSell} = false`);
    }
    const where = and(...clauses);
    const caseQty = sql<number>`coalesce(${productPackaging.caseQty}, 0)`;
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
                      ? [direction(demandProjection.isLockedForSell), tieBreak]
                      : query.sortBy === "availableToSell"
                        ? [
                            staffCatalogAvailableToSellOrderBySql(
                              demandProjection.availableToSell,
                              query.sortOrder,
                            ),
                            tieBreak,
                          ]
                        : query.sortBy === "caseQty"
                          ? [direction(caseQty), tieBreak]
                          : [direction(products.createdAt), tieBreak];
    const offset = (query.page - 1) * query.pageSize;

    const locationJoin = and(
      eq(locations.organizationId, products.organizationId),
      eq(locations.code, DEFAULT_LOCATION_CODE),
    );
    const snapshotJoin = and(
      eq(stockSnapshots.organizationId, products.organizationId),
      eq(stockSnapshots.sku, products.sku),
      eq(stockSnapshots.locationId, locations.id),
    );
    const countFrom =
      query.hideZeroInventory === true ||
      query.availableOnly === true ||
      query.sellState !== undefined
        ? this.db
            .select({ value: count() })
            .from(products)
            .leftJoin(locations, locationJoin)
            .leftJoin(stockSnapshots, snapshotJoin)
        : this.db.select({ value: count() }).from(products);

    const [totalRows, rows] = await Promise.all([
      countFrom.where(where),
      this.db
        .select({
          id: products.id,
          organizationId: products.organizationId,
          sku: products.sku,
          name: products.name,
          description: products.description,
          uom: products.uom,
          memberPriceCents: products.memberPriceCents,
          listPriceCents: products.listPriceCents,
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
          lastPoCostCents,
          supplierName,
        })
        .from(products)
        .leftJoin(locations, locationJoin)
        .leftJoin(stockSnapshots, snapshotJoin)
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
        lastPoCostCents: normalizeCents(row.lastPoCostCents),
        supplierName: row.supplierName,
      })),
      total: totalRows[0]?.value ?? 0,
    };
  }
}
