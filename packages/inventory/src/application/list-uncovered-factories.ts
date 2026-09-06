import { LocationId, OrganizationId, requireOrganizationId, type SupplierId } from "@dc-inventory/shared-kernel";
import type { IUncoveredListQuery } from "../domain/ports/uncovered-list-query.js";
import type {
  IUncoveredSkuSupplierMappingReadPort,
  IUncoveredSkuSupplierReadPort,
} from "../domain/ports/uncovered-sku-enrichment.js";

export const UNCOVERED_NEEDS_MAPPING_FACTORY_ROW_ID = "needs-mapping";

export type UncoveredFactorySummaryRow = Readonly<{
  id: string;
  supplierId: SupplierId | null;
  supplierNumber: string | null;
  supplierName: string;
  productCount: number;
  totalUncoveredUnits: number;
  needsMapping: boolean;
}>;

export type ListUncoveredFactoriesRequest = {
  organizationId: OrganizationId;
  locationId?: LocationId;
};

export type ListUncoveredFactoriesResult = {
  items: UncoveredFactorySummaryRow[];
};

export class ListUncoveredFactoriesUseCase {
  constructor(
    private readonly uncoveredList: IUncoveredListQuery,
    private readonly supplierMapping: IUncoveredSkuSupplierMappingReadPort,
    private readonly suppliers: IUncoveredSkuSupplierReadPort,
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
        productCount: needsMappingProductCount,
        totalUncoveredUnits: needsMappingUnits,
        needsMapping: true,
      });
    }

    return { items };
  }
}
