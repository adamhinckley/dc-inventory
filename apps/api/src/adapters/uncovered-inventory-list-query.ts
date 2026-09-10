import {
  computeUncovered,
  type IUncoveredListQuery,
  type UncoveredFactoryListQuery,
  type UncoveredListQuery,
} from "@dc-inventory/inventory";
import { locations, stockSnapshots } from "@dc-inventory/inventory/schema";
import {
  purchaseOrderLines,
  purchaseOrders,
  supplierProducts,
  suppliers,
} from "@dc-inventory/purchasing/schema";
import { LocationId, OrganizationId, Sku, SupplierId } from "@dc-inventory/shared-kernel";
import { and, asc, count, eq, gt, sql } from "drizzle-orm";
import type { AppDrizzle } from "../infrastructure/db.js";

const DEFAULT_LOCATION_CODE = "DEFAULT";

/**
 * Paged uncovered SKU read from movement-derived stock snapshots.
 * Formula only — catalog/reorder joins happen in `ListUncoveredSkusUseCase`.
 */
export class UncoveredInventoryListQuery implements IUncoveredListQuery {
  private readonly locationUuidByOrgAndCode = new Map<string, Promise<string | null>>();

  constructor(private readonly db: AppDrizzle) {}

  private locationCacheKey(organizationId: OrganizationId, locationId: LocationId): string {
    return `${organizationId}:${locationId}`;
  }

  private resolveLocationUuid(
    organizationId: OrganizationId,
    locationId: LocationId,
  ): Promise<string | null> {
    const cacheKey = this.locationCacheKey(organizationId, locationId);
    const cached = this.locationUuidByOrgAndCode.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    const loaded = this.loadLocationUuid(organizationId, locationId)
      .then((id) => {
        if (id === null) {
          this.locationUuidByOrgAndCode.delete(cacheKey);
        }
        return id;
      })
      .catch((error: unknown) => {
        this.locationUuidByOrgAndCode.delete(cacheKey);
        throw error;
      });
    this.locationUuidByOrgAndCode.set(cacheKey, loaded);
    return loaded;
  }

  private async loadLocationUuid(
    organizationId: OrganizationId,
    locationId: LocationId,
  ): Promise<string | null> {
    const locationRows = await this.db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.organizationId, organizationId),
          eq(
            locations.code,
            locationId === LocationId.DEFAULT ? DEFAULT_LOCATION_CODE : locationId,
          ),
        ),
      )
      .limit(1);
    return locationRows[0]?.id ?? null;
  }

  private uncoveredExpr() {
    const onHand = sql<number>`coalesce(${stockSnapshots.onHand}, 0)`;
    const onOrder = sql<number>`coalesce(${stockSnapshots.onOrder}, 0)`;
    const committed = sql<number>`coalesce(${stockSnapshots.committed}, 0)`;
    const uncovered = sql<number>`greatest(0, ${committed} - ${onHand} - ${onOrder})`;
    return { onHand, onOrder, committed, uncovered };
  }

  private supplierMappingCountSql(organizationId: OrganizationId) {
    return sql<number>`(
      select count(*)::int
      from ${supplierProducts} sp
      inner join ${suppliers} s on sp.supplier_id = s.id
      where sp.sku = ${stockSnapshots.sku}
        and s.organization_id = ${organizationId}
    )`;
  }

  private mappingFilterSql(
    organizationId: OrganizationId,
    supplierId: SupplierId | undefined,
    needsMapping: boolean | undefined,
  ) {
    const mappingCount = this.supplierMappingCountSql(organizationId);
    if (needsMapping === true) {
      return sql`${mappingCount} <> 1`;
    }
    if (supplierId !== undefined) {
      return and(
        eq(mappingCount, 1),
        sql`exists (
          select 1
          from ${supplierProducts} sp
          inner join ${suppliers} s on sp.supplier_id = s.id
          where sp.sku = ${stockSnapshots.sku}
            and s.organization_id = ${organizationId}
            and sp.supplier_id = ${supplierId}
        )`,
      );
    }
    return undefined;
  }

  private uncoveredWhere(
    organizationId: OrganizationId,
    locationUuid: string,
    supplierId?: SupplierId,
    needsMapping?: boolean,
  ) {
    const { uncovered } = this.uncoveredExpr();
    const mappingFilter = this.mappingFilterSql(organizationId, supplierId, needsMapping);
    return and(
      eq(stockSnapshots.organizationId, organizationId),
      eq(stockSnapshots.locationId, locationUuid),
      gt(uncovered, 0),
      mappingFilter,
    );
  }

  async list(query: UncoveredListQuery) {
    const organizationId = OrganizationId.parse(query.organizationId);
    const locationId = query.locationId ?? LocationId.DEFAULT;
    const locationUuid = await this.resolveLocationUuid(organizationId, locationId);
    if (locationUuid === null) {
      return { items: [], total: 0 };
    }

    const where = this.uncoveredWhere(
      organizationId,
      locationUuid,
      query.supplierId,
      query.needsMapping,
    );
    const offset = (query.page - 1) * query.pageSize;

    const [totalRow] = await this.db
      .select({ total: count() })
      .from(stockSnapshots)
      .where(where);
    const rows = await this.db
      .select({
        sku: stockSnapshots.sku,
        onHand: stockSnapshots.onHand,
        onOrder: stockSnapshots.onOrder,
        committed: stockSnapshots.committed,
      })
      .from(stockSnapshots)
      .where(where)
      .orderBy(asc(stockSnapshots.sku))
      .limit(query.pageSize)
      .offset(offset);

    return {
      total: Number(totalRow?.total ?? 0),
      items: rows.map((row) =>
        Object.freeze({
          sku: Sku.parse(row.sku),
          committed: row.committed,
          onHand: row.onHand,
          onOrder: row.onOrder,
          uncovered: computeUncovered(row.committed, row.onHand, row.onOrder),
        }),
      ),
    };
  }

  async listAll(query: Omit<UncoveredListQuery, "page" | "pageSize" | "supplierId" | "needsMapping">) {
    const organizationId = OrganizationId.parse(query.organizationId);
    const locationId = query.locationId ?? LocationId.DEFAULT;
    const locationUuid = await this.resolveLocationUuid(organizationId, locationId);
    if (locationUuid === null) {
      return [];
    }

    const where = this.uncoveredWhere(organizationId, locationUuid);
    const rows = await this.db
      .select({
        sku: stockSnapshots.sku,
        onHand: stockSnapshots.onHand,
        onOrder: stockSnapshots.onOrder,
        committed: stockSnapshots.committed,
      })
      .from(stockSnapshots)
      .where(where)
      .orderBy(asc(stockSnapshots.sku));

    return rows.map((row) =>
      Object.freeze({
        sku: Sku.parse(row.sku),
        committed: row.committed,
        onHand: row.onHand,
        onOrder: row.onOrder,
        uncovered: computeUncovered(row.committed, row.onHand, row.onOrder),
      }),
    );
  }

  async listFactories(query: UncoveredFactoryListQuery) {
    const organizationId = OrganizationId.parse(query.organizationId);
    const locationId = query.locationId ?? LocationId.DEFAULT;
    const locationUuid = await this.resolveLocationUuid(organizationId, locationId);
    if (locationUuid === null) {
      return { items: [], total: 0 };
    }

    const { uncovered } = this.uncoveredExpr();
    const mappingCount = this.supplierMappingCountSql(organizationId);
    const offset = (query.page - 1) * query.pageSize;

    const uncoveredSkus = this.db.$with("uncovered_skus").as(
      this.db
        .select({
          sku: stockSnapshots.sku,
          uncovered,
        })
        .from(stockSnapshots)
        .where(
          and(
            eq(stockSnapshots.organizationId, organizationId),
            eq(stockSnapshots.locationId, locationUuid),
            gt(uncovered, 0),
          ),
        ),
    );

    const mappedSkus = this.db.$with("mapped_skus").as(
      this.db
        .with(uncoveredSkus)
        .select({
          sku: uncoveredSkus.sku,
          uncovered: uncoveredSkus.uncovered,
          supplierId: supplierProducts.supplierId,
        })
        .from(uncoveredSkus)
        .innerJoin(supplierProducts, eq(supplierProducts.sku, uncoveredSkus.sku))
        .innerJoin(
          suppliers,
          and(
            eq(supplierProducts.supplierId, suppliers.id),
            eq(suppliers.organizationId, organizationId),
          ),
        )
        .where(
          sql`(
            select count(*)::int
            from ${supplierProducts} sp
            inner join ${suppliers} s on sp.supplier_id = s.id
            where sp.sku = ${uncoveredSkus.sku}
              and s.organization_id = ${organizationId}
          ) = 1`,
        ),
    );

    const factoryRollup = this.db.$with("factory_rollup").as(
      this.db
        .with(mappedSkus)
        .select({
          supplierId: mappedSkus.supplierId,
          productCount: sql<number>`count(*)::int`.as("product_count"),
          totalUncoveredUnits: sql<number>`sum(${mappedSkus.uncovered})::int`.as(
            "total_uncovered_units",
          ),
          needsMapping: sql<boolean>`false`.as("needs_mapping"),
          sortKey: suppliers.name,
        })
        .from(mappedSkus)
        .innerJoin(suppliers, eq(mappedSkus.supplierId, suppliers.id))
        .groupBy(mappedSkus.supplierId, suppliers.name),
    );

    const needsMappingRollup = this.db.$with("needs_mapping_rollup").as(
      this.db
        .with(uncoveredSkus)
        .select({
          supplierId: sql<string | null>`null`.as("supplier_id"),
          productCount: sql<number>`count(*)::int`.as("product_count"),
          totalUncoveredUnits: sql<number>`coalesce(sum(${uncoveredSkus.uncovered}), 0)::int`.as(
            "total_uncovered_units",
          ),
          needsMapping: sql<boolean>`true`.as("needs_mapping"),
          sortKey: sql<string>`'Needs mapping'`.as("sort_key"),
        })
        .from(uncoveredSkus)
        .where(
          sql`(
            select count(*)::int
            from ${supplierProducts} sp
            inner join ${suppliers} s on sp.supplier_id = s.id
            where sp.sku = ${uncoveredSkus.sku}
              and s.organization_id = ${organizationId}
          ) <> 1`,
        ),
    );

    const suppliersWithOpenDraft =
      query.excludeSuppliersWithOpenDraft === true
        ? this.db.$with("suppliers_with_open_draft").as(
            this.db
              .with(mappedSkus)
              .selectDistinct({ supplierId: purchaseOrders.supplierId })
              .from(purchaseOrders)
              .innerJoin(
                purchaseOrderLines,
                eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id),
              )
              .innerJoin(
                mappedSkus,
                and(
                  eq(mappedSkus.supplierId, purchaseOrders.supplierId),
                  eq(mappedSkus.sku, purchaseOrderLines.sku),
                ),
              )
              .where(
                and(
                  eq(purchaseOrders.organizationId, organizationId),
                  eq(purchaseOrders.status, "draft"),
                ),
              ),
          )
        : undefined;

    const factoryCte = suppliersWithOpenDraft
      ? this.db.$with("factory_rows").as(
          this.db
            .with(uncoveredSkus, mappedSkus, factoryRollup, needsMappingRollup, suppliersWithOpenDraft)
            .select({
              supplierId: sql<string | null>`${factoryRollup.supplierId}`.as("supplier_id"),
              productCount: factoryRollup.productCount,
              totalUncoveredUnits: factoryRollup.totalUncoveredUnits,
              needsMapping: factoryRollup.needsMapping,
              sortOrder: sql<number>`0`.as("sort_order"),
              sortKey: factoryRollup.sortKey,
            })
            .from(factoryRollup)
            .where(
              sql`${factoryRollup.supplierId} not in (select supplier_id from ${suppliersWithOpenDraft})`,
            )
            .unionAll(
              this.db
                .select({
                  supplierId: sql<string | null>`${needsMappingRollup.supplierId}`.as("supplier_id"),
                  productCount: needsMappingRollup.productCount,
                  totalUncoveredUnits: needsMappingRollup.totalUncoveredUnits,
                  needsMapping: needsMappingRollup.needsMapping,
                  sortOrder: sql<number>`1`.as("sort_order"),
                  sortKey: needsMappingRollup.sortKey,
                })
                .from(needsMappingRollup)
                .where(gt(needsMappingRollup.productCount, 0)),
            ),
        )
      : this.db.$with("factory_rows").as(
          this.db
            .with(uncoveredSkus, mappedSkus, factoryRollup, needsMappingRollup)
            .select({
              supplierId: sql<string | null>`${factoryRollup.supplierId}`.as("supplier_id"),
              productCount: factoryRollup.productCount,
              totalUncoveredUnits: factoryRollup.totalUncoveredUnits,
              needsMapping: factoryRollup.needsMapping,
              sortOrder: sql<number>`0`.as("sort_order"),
              sortKey: factoryRollup.sortKey,
            })
            .from(factoryRollup)
            .unionAll(
              this.db
                .select({
                  supplierId: sql<string | null>`${needsMappingRollup.supplierId}`.as("supplier_id"),
                  productCount: needsMappingRollup.productCount,
                  totalUncoveredUnits: needsMappingRollup.totalUncoveredUnits,
                  needsMapping: needsMappingRollup.needsMapping,
                  sortOrder: sql<number>`1`.as("sort_order"),
                  sortKey: needsMappingRollup.sortKey,
                })
                .from(needsMappingRollup)
                .where(gt(needsMappingRollup.productCount, 0)),
            ),
        );

    const withChain = suppliersWithOpenDraft
      ? [uncoveredSkus, mappedSkus, factoryRollup, needsMappingRollup, suppliersWithOpenDraft, factoryCte]
      : [uncoveredSkus, mappedSkus, factoryRollup, needsMappingRollup, factoryCte];

    const [totalRow] = await this.db
      .with(...withChain)
      .select({ total: count() })
      .from(factoryCte);

    const rows = await this.db
      .with(...withChain)
      .select({
        supplierId: factoryCte.supplierId,
        productCount: factoryCte.productCount,
        totalUncoveredUnits: factoryCte.totalUncoveredUnits,
        needsMapping: factoryCte.needsMapping,
      })
      .from(factoryCte)
      .orderBy(asc(factoryCte.sortOrder), asc(factoryCte.sortKey))
      .limit(query.pageSize)
      .offset(offset);

    return {
      total: Number(totalRow?.total ?? 0),
      items: rows.map((row) =>
        Object.freeze({
          supplierId: row.supplierId === null ? null : SupplierId.parse(row.supplierId),
          productCount: Number(row.productCount),
          totalUncoveredUnits: Number(row.totalUncoveredUnits),
          needsMapping: Boolean(row.needsMapping),
        }),
      ),
    };
  }
}
