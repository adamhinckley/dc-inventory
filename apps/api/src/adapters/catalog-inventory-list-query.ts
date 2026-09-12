import {
  type CatalogListQuery,
  type ICatalogListQuery,
  type Product,
  type ProductQty,
  emptyProductCatalogAttributes,
  resolveCatalogListAvailabilityFilter,
} from "@dc-inventory/catalog";
import {
  isWholesaleHiddenBeforeOpenSql,
  matchesWholesaleAvailabilityFilterSql,
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
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import type { AppDrizzle } from "../infrastructure/db.js";
import { normalizeCents } from "./normalize-cents.js";
import { productQtyFromSnapshotRow } from "./product-qty-from-snapshot.js";

const DEFAULT_LOCATION_CODE = "DEFAULT";

/**
 * Org-scoped supplier CTEs for staff catalog list/export.
 *
 * `primary_supplier_id` uses the earliest `supplier_products.id` per SKU (deterministic);
 * the old correlated `limit 1` subquery had no ORDER BY.
 */
export function staffCatalogSupplierCtes(db: AppDrizzle, organizationId: OrganizationId) {
  const supplierLinks = db.$with("supplier_links").as(
    db
      .select({
        organizationId: suppliers.organizationId,
        sku: supplierProducts.sku,
        name: suppliers.name,
        supplierId: supplierProducts.supplierId,
        lastPoCostCents: supplierProducts.lastPoCostCents,
        updatedAt: supplierProducts.updatedAt,
        id: supplierProducts.id,
      })
      .from(supplierProducts)
      .innerJoin(suppliers, eq(suppliers.id, supplierProducts.supplierId))
      .where(eq(suppliers.organizationId, organizationId)),
  );

  const supplierBySku = db.$with("supplier_by_sku").as(
    db
      .select({
        organizationId: supplierLinks.organizationId,
        sku: supplierLinks.sku,
        supplierName: sql<string | null>`string_agg(${supplierLinks.name}, ', ' order by ${supplierLinks.name})`.as(
          "supplier_name",
        ),
        primarySupplierId: sql<string | null>`(array_agg(${supplierLinks.supplierId} order by ${supplierLinks.id}))[1]`.as(
          "primary_supplier_id",
        ),
      })
      .from(supplierLinks)
      .groupBy(supplierLinks.organizationId, supplierLinks.sku),
  );

  const supplierLastPo = db.$with("supplier_last_po").as(
    db
      .selectDistinctOn([supplierLinks.organizationId, supplierLinks.sku], {
        organizationId: supplierLinks.organizationId,
        sku: supplierLinks.sku,
        lastPoCostCents: supplierLinks.lastPoCostCents,
      })
      .from(supplierLinks)
      .where(sql`${supplierLinks.lastPoCostCents} is not null`)
      .orderBy(supplierLinks.organizationId, supplierLinks.sku, desc(supplierLinks.updatedAt)),
  );

  const supplierEnrichment = db.$with("supplier_enrichment").as(
    db
      .select({
        organizationId: supplierBySku.organizationId,
        sku: supplierBySku.sku,
        supplierName: supplierBySku.supplierName,
        primarySupplierId: supplierBySku.primarySupplierId,
        lastPoCostCents: supplierLastPo.lastPoCostCents,
      })
      .from(supplierBySku)
      .leftJoin(
        supplierLastPo,
        and(
          eq(supplierLastPo.organizationId, supplierBySku.organizationId),
          eq(supplierLastPo.sku, supplierBySku.sku),
        ),
      ),
  );

  const joinSupplierBySku = and(
    eq(supplierBySku.organizationId, products.organizationId),
    eq(supplierBySku.sku, products.sku),
  );
  const joinSupplierEnrichment = and(
    eq(supplierEnrichment.organizationId, products.organizationId),
    eq(supplierEnrichment.sku, products.sku),
  );

  return {
    supplierLinks,
    supplierBySku,
    supplierLastPo,
    supplierEnrichment,
    joinSupplierBySku,
    joinSupplierEnrichment,
    countCtes: [supplierLinks, supplierBySku] as const,
    pageCtes: [supplierLinks, supplierBySku, supplierLastPo, supplierEnrichment] as const,
  };
}

/** SQL for staff catalog list COUNT/PAGE without executing (tests + query review). */
export function staffCatalogListQuerySql(
  db: AppDrizzle,
  query: CatalogListQuery,
  now: Date = new Date(),
) {
  const built = buildStaffCatalogListQueries(db, query, now);
  return {
    countSql: built.countQuery.toSQL(),
    pageSql: built.pageQuery.toSQL(),
  };
}

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
  countryOfOrigin: string | null;
  material: string | null;
  length: string | null;
  width: string | null;
  height: string | null;
  diameter: string | null;
  size: string | null;
  weight: string | null;
  weightUom: string | null;
  originalWholesalePriceCents: number | null;
  catalogPage: string | null;
  defaultOrderQty: number | null;
  defaultWeight: string | null;
  defaultWeightUom: string | null;
  nonStock: boolean;
  noExport: boolean;
  webRetail: boolean;
}): Product {
  const defaults = emptyProductCatalogAttributes();
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
    countryOfOrigin: row.countryOfOrigin ?? defaults.countryOfOrigin,
    material: row.material ?? defaults.material,
    length: row.length ?? defaults.length,
    width: row.width ?? defaults.width,
    height: row.height ?? defaults.height,
    diameter: row.diameter ?? defaults.diameter,
    size: row.size ?? defaults.size,
    weight: row.weight ?? defaults.weight,
    weightUom: row.weightUom ?? defaults.weightUom,
    originalWholesalePrice:
      row.originalWholesalePriceCents === null
        ? null
        : Money.fromMinorUnits(row.originalWholesalePriceCents, row.currency),
    catalogPage: row.catalogPage ?? defaults.catalogPage,
    defaultOrderQty: row.defaultOrderQty ?? defaults.defaultOrderQty,
    defaultWeight: row.defaultWeight ?? defaults.defaultWeight,
    defaultWeightUom: row.defaultWeightUom ?? defaults.defaultWeightUom,
    nonStock: row.nonStock ?? defaults.nonStock,
    noExport: row.noExport ?? defaults.noExport,
    webRetail: row.webRetail ?? defaults.webRetail,
  };
}

/**
 * Dedicated Catalog plus Inventory list projection.
 *
 * Inventory's movement-derived snapshot remains the only source of quantity.
 * The adapter only reads that projection for filtering, ordering, and paging.
 */
function buildStaffCatalogListQueries(
  db: AppDrizzle,
  query: CatalogListQuery,
  now: Date,
) {
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
    const productIds = db
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
    const factorySkus = db
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
  const excludeSupplierIds = (query.excludeSupplierId ?? [])
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  const includeSupplierEnrichment = query.shopVisibleOnly !== true;
  const supplierCtes = includeSupplierEnrichment
    ? staffCatalogSupplierCtes(db, query.organizationId)
    : null;
  const needsSupplierJoinOnCount = excludeSupplierIds.length > 0 && supplierCtes !== null;
  if (needsSupplierJoinOnCount) {
    clauses.push(
      or(
        isNull(supplierCtes.supplierBySku.primarySupplierId),
        notInArray(supplierCtes.supplierBySku.primarySupplierId, excludeSupplierIds),
      )!,
    );
  }
  const onHand = sql<number>`coalesce(${stockSnapshots.onHand}, 0)`;
  const onOrder = sql<number>`coalesce(${stockSnapshots.onOrder}, 0)`;
  const allocated = sql<number>`coalesce(${stockSnapshots.allocated}, 0)`;
  const available = sql<number>`${onHand} - ${allocated}`;
  const committed = sql<number>`coalesce(${stockSnapshots.committed}, 0)`;
  const stickyLocked = sql<boolean>`coalesce(${stockSnapshots.stickyLocked}, false)`;
  const nowIso = now.toISOString();
  const demandProjectionColumns = {
    onHand: stockSnapshots.onHand,
    onOrder: stockSnapshots.onOrder,
    committed: stockSnapshots.committed,
    stickyLocked: stockSnapshots.stickyLocked,
    windowOpensAt: stockSnapshots.windowOpensAt,
    windowClosesAt: stockSnapshots.windowClosesAt,
  };
  const demandProjectionCatalogColumns = {
    organizationId: products.organizationId,
    sku: products.sku,
  };
  const demandProjection = staffCatalogDemandProjectionSql(
    demandProjectionColumns,
    nowIso,
    demandProjectionCatalogColumns,
  );
  const availabilityFilters = resolveCatalogListAvailabilityFilter(query);
  if (query.hideZeroInventory === true) {
    clauses.push(or(gt(onHand, 0), gt(onOrder, 0), gt(allocated, 0), gt(committed, 0))!);
  }
  if (
    availabilityFilters !== null &&
    (availabilityFilters.inStockOnly || availabilityFilters.preOrderOnly)
  ) {
    clauses.push(
      matchesWholesaleAvailabilityFilterSql(
        demandProjectionColumns,
        nowIso,
        availabilityFilters,
        demandProjectionCatalogColumns,
      ),
    );
  }
  if (query.hideBeforeOpen === true) {
    clauses.push(
      isWholesaleHiddenBeforeOpenSql(
        demandProjectionColumns,
        nowIso,
        demandProjection.hasActiveSellWindowMembership,
      ),
    );
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
  const needsInventoryJoin =
    query.hideZeroInventory === true ||
    (availabilityFilters !== null &&
      (availabilityFilters.inStockOnly || availabilityFilters.preOrderOnly)) ||
    query.hideBeforeOpen === true ||
    query.sellState !== undefined;

  const countBase = needsSupplierJoinOnCount && supplierCtes !== null
    ? db
        .with(...supplierCtes.countCtes)
        .select({ value: count() })
        .from(products)
        .leftJoin(supplierCtes.supplierBySku, supplierCtes.joinSupplierBySku)
    : db.select({ value: count() }).from(products);
  const countQuery = needsInventoryJoin
    ? countBase.leftJoin(locations, locationJoin).leftJoin(stockSnapshots, snapshotJoin)
    : countBase;

  const pageSelect = {
    id: products.id,
    organizationId: products.organizationId,
    sku: products.sku,
    name: products.name,
    description: products.description,
    uom: products.uom,
    countryOfOrigin: products.countryOfOrigin,
    material: products.material,
    length: products.length,
    width: products.width,
    height: products.height,
    diameter: products.diameter,
    size: products.size,
    weight: products.weight,
    weightUom: products.weightUom,
    memberPriceCents: products.memberPriceCents,
    listPriceCents: products.listPriceCents,
    originalWholesalePriceCents: products.originalWholesalePriceCents,
    currency: products.currency,
    catalogPage: products.catalogPage,
    defaultOrderQty: products.defaultOrderQty,
    defaultWeight: products.defaultWeight,
    defaultWeightUom: products.defaultWeightUom,
    inactive: products.inactive,
    discontinued: products.discontinued,
    nonStock: products.nonStock,
    noExport: products.noExport,
    webWholesale: products.webWholesale,
    webRetail: products.webRetail,
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
    hasActiveSellWindowMembership: demandProjection.hasActiveSellWindowMembership,
    caseQty: productPackaging.caseQty,
    lastPoCostCents:
      supplierCtes === null
        ? sql<number | null>`null`
        : supplierCtes.supplierEnrichment.lastPoCostCents,
    supplierName:
      supplierCtes === null
        ? sql<string | null>`null`
        : supplierCtes.supplierEnrichment.supplierName,
  };
  let pageQuery = supplierCtes === null
    ? db
        .select(pageSelect)
        .from(products)
        .leftJoin(locations, locationJoin)
        .leftJoin(stockSnapshots, snapshotJoin)
        .leftJoin(productPackaging, eq(productPackaging.productId, products.id))
    : db
        .with(...supplierCtes.pageCtes)
        .select(pageSelect)
        .from(products)
        .leftJoin(locations, locationJoin)
        .leftJoin(stockSnapshots, snapshotJoin)
        .leftJoin(productPackaging, eq(productPackaging.productId, products.id))
        .leftJoin(supplierCtes.supplierEnrichment, supplierCtes.joinSupplierEnrichment);

  return {
    countQuery: countQuery.where(where),
    pageQuery: pageQuery
      .where(where)
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset(offset),
    now,
  };
}

export class CatalogInventoryListQuery implements ICatalogListQuery {
  constructor(
    private readonly db: AppDrizzle,
    private readonly clock?: IClock,
  ) {}

  async list(query: CatalogListQuery) {
    const now = this.clock ? this.clock.now() : new Date();
    const { countQuery, pageQuery, now: evaluatedAt } = buildStaffCatalogListQueries(
      this.db,
      query,
      now,
    );
    const [totalRows, rows] = await Promise.all([countQuery, pageQuery]);

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
            hasActiveSellWindowMembership: row.hasActiveSellWindowMembership,
          },
          evaluatedAt,
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
