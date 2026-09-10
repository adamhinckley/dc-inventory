import {
  LocationId,
  OrganizationId,
  requireOrganizationId,
  type Sku,
  type SupplierId,
} from "@dc-inventory/shared-kernel";
import type { IUncoveredListQuery } from "../domain/ports/uncovered-list-query.js";
import type {
  IUncoveredSkuDraftPurchaseOrderReadPort,
  IUncoveredSkuSupplierMappingReadPort,
  IUncoveredSkuSupplierReadPort,
} from "../domain/ports/uncovered-sku-enrichment.js";
import { uncoveredSkuDraftKey } from "../domain/ports/uncovered-sku-enrichment.js";

export const UNCOVERED_NEEDS_MAPPING_FACTORY_ROW_ID = "needs-mapping";

export type UncoveredFactorySummaryRow = Readonly<{
  id: string;
  supplierId: SupplierId | null;
  supplierNumber: string | null;
  supplierName: string;
  poPrefix: string | null;
  productCount: number;
  totalUncoveredUnits: number;
  needsMapping: boolean;
}>;

export type ListUncoveredFactoriesRequest = {
  organizationId: OrganizationId;
  locationId?: LocationId;
  excludeSuppliersWithOpenDraft?: boolean;
};

export type ListUncoveredFactoriesResult = {
  items: UncoveredFactorySummaryRow[];
};

export class ListUncoveredFactoriesUseCase {
  constructor(
    private readonly uncoveredList: IUncoveredListQuery,
    private readonly supplierMapping: IUncoveredSkuSupplierMappingReadPort,
    private readonly suppliers: IUncoveredSkuSupplierReadPort,
    private readonly openDraftPurchaseOrders: IUncoveredSkuDraftPurchaseOrderReadPort,
  ) {}

  async execute(input: ListUncoveredFactoriesRequest): Promise<ListUncoveredFactoriesResult> {
    const organizationId = requireOrganizationId(input.organizationId);
    const resolvedLocationId = input.locationId ?? LocationId.DEFAULT;
    const rows = await this.uncoveredList.listAll({
      organizationId,
      locationId: resolvedLocationId,
    });
    const mappings = await this.supplierMapping.getSkuMappings(
      organizationId,
      rows.map((row) => row.sku),
    );

    const bySupplier = new Map<SupplierId, { productCount: number; totalUncoveredUnits: number }>();
    const supplierSkus = new Map<SupplierId, Sku[]>();
    let needsMappingProductCount = 0;
    let needsMappingUnits = 0;

    for (const row of rows) {
      const mapping = mappings.get(row.sku.value) ?? {
        status: "unmapped",
        supplierId: null,
      };
      if (mapping.status === "mapped" && mapping.supplierId !== null) {
        const existing = bySupplier.get(mapping.supplierId) ?? {
          productCount: 0,
          totalUncoveredUnits: 0,
        };
        existing.productCount += 1;
        existing.totalUncoveredUnits += row.uncovered;
        bySupplier.set(mapping.supplierId, existing);
        const skus = supplierSkus.get(mapping.supplierId) ?? [];
        skus.push(row.sku);
        supplierSkus.set(mapping.supplierId, skus);
        continue;
      }
      needsMappingProductCount += 1;
      needsMappingUnits += row.uncovered;
    }

    const supplierIds = [...bySupplier.keys()];
    const supplierInfo = await this.suppliers.findByIds(organizationId, supplierIds);
    const items: UncoveredFactorySummaryRow[] = [];
    for (const supplierId of supplierIds) {
      const aggregate = bySupplier.get(supplierId);
      if (aggregate === undefined) {
        continue;
      }
      const supplier = supplierInfo.get(supplierId);
      items.push({
        id: supplierId,
        supplierId,
        supplierNumber: supplier?.supplierNumber ?? null,
        supplierName: supplier?.supplierName ?? "Unknown factory",
        poPrefix: supplier?.poPrefix ?? null,
        productCount: aggregate.productCount,
        totalUncoveredUnits: aggregate.totalUncoveredUnits,
        needsMapping: false,
      });
    }
    items.sort((left, right) => left.supplierName.localeCompare(right.supplierName));

    if (needsMappingProductCount > 0) {
      items.push({
        id: UNCOVERED_NEEDS_MAPPING_FACTORY_ROW_ID,
        supplierId: null,
        supplierNumber: null,
        supplierName: "Needs mapping",
        poPrefix: null,
        productCount: needsMappingProductCount,
        totalUncoveredUnits: needsMappingUnits,
        needsMapping: true,
      });
    }

    if (input.excludeSuppliersWithOpenDraft === true && supplierSkus.size > 0) {
      const draftLookupByKey = new Map<string, { supplierId: SupplierId; sku: Sku }>();
      for (const [supplierId, skus] of supplierSkus) {
        for (const sku of skus) {
          draftLookupByKey.set(uncoveredSkuDraftKey(supplierId, sku), { supplierId, sku });
        }
      }
      const openDrafts = await this.openDraftPurchaseOrders.findOpenDraftsForSupplierSkus(
        organizationId,
        [...draftLookupByKey.values()],
      );
      const suppliersWithOpenDraft = new Set<SupplierId>();
      for (const [supplierId, skus] of supplierSkus) {
        for (const sku of skus) {
          if (openDrafts.has(uncoveredSkuDraftKey(supplierId, sku))) {
            suppliersWithOpenDraft.add(supplierId);
            break;
          }
        }
      }
      return {
        items: items.filter(
          (row) =>
            row.needsMapping ||
            row.supplierId === null ||
            !suppliersWithOpenDraft.has(row.supplierId),
        ),
      };
    }

    return { items };
  }
}
