import { LocationId, OrganizationId, requireOrganizationId, type Sku, type SupplierId } from "@dc-inventory/shared-kernel";
import type {
  IUncoveredListQuery,
  UncoveredListCoreRow,
  UncoveredListRow,
} from "../domain/ports/uncovered-list-query.js";
import type {
  IUncoveredCaseQtyReadPort,
  IUncoveredReorderPolicyReadPort,
} from "../domain/ports/uncovered-stock-context.js";
import type {
  IUncoveredSkuDraftPurchaseOrderReadPort,
  IUncoveredSkuSupplierMappingReadPort,
  IUncoveredSkuSupplierReadPort,
} from "../domain/ports/uncovered-sku-enrichment.js";
import { uncoveredSkuDraftKey } from "../domain/ports/uncovered-sku-enrichment.js";

export type ListUncoveredSkusRequest = {
  organizationId: OrganizationId;
  locationId?: LocationId;
  page: number;
  pageSize: number;
  supplierId?: SupplierId;
  needsMapping?: boolean;
};

export type ListUncoveredSkusResult = {
  items: UncoveredListRow[];
  page: number;
  pageSize: number;
  total: number;
};

function matchesFilter(
  mapping: { status: string; supplierId: SupplierId | null },
  supplierId: SupplierId | undefined,
  needsMapping: boolean | undefined,
): boolean {
  if (needsMapping === true) {
    return mapping.status !== "mapped";
  }
  if (supplierId !== undefined) {
    return mapping.status === "mapped" && mapping.supplierId === supplierId;
  }
  return true;
}

export class ListUncoveredSkusUseCase {
  constructor(
    private readonly uncoveredList: IUncoveredListQuery,
    private readonly caseQty: IUncoveredCaseQtyReadPort,
    private readonly reorderPolicies: IUncoveredReorderPolicyReadPort,
    private readonly supplierMapping: IUncoveredSkuSupplierMappingReadPort,
    private readonly suppliers: IUncoveredSkuSupplierReadPort,
    private readonly openDraftPurchaseOrders: IUncoveredSkuDraftPurchaseOrderReadPort,
  ) {}

  async execute(input: ListUncoveredSkusRequest): Promise<ListUncoveredSkusResult> {
    const organizationId = requireOrganizationId(input.organizationId);
    const resolvedLocationId = input.locationId ?? LocationId.DEFAULT;
    const hasFilter = input.supplierId !== undefined || input.needsMapping === true;

    let coreRows: readonly UncoveredListCoreRow[];
    let total: number;

    if (hasFilter) {
      const allRows = await this.uncoveredList.listAll({
        organizationId,
        locationId: resolvedLocationId,
      });
      const allMappings = await this.supplierMapping.getSkuMappings(
        organizationId,
        allRows.map((row) => row.sku),
      );
      const filtered = allRows.filter((row) => {
        const mapping = allMappings.get(row.sku.value) ?? {
          status: "unmapped",
          supplierId: null,
        };
        return matchesFilter(mapping, input.supplierId, input.needsMapping);
      });
      total = filtered.length;
      const offset = (input.page - 1) * input.pageSize;
      coreRows = filtered.slice(offset, offset + input.pageSize);
    } else {
      const page = await this.uncoveredList.list({
        organizationId,
        locationId: resolvedLocationId,
        page: input.page,
        pageSize: input.pageSize,
      });
      coreRows = page.items;
      total = page.total;
    }

    const skus = coreRows.map((row) => row.sku);
    const [packaging, reorderPolicies, mappings] = await Promise.all([
      this.caseQty.readBySkus(organizationId, skus),
      this.reorderPolicies.readBySkus(organizationId, resolvedLocationId, skus),
      this.supplierMapping.getSkuMappings(organizationId, skus),
    ]);

    const mappedSupplierIds = [
      ...new Set(
        skus
          .map((sku) => mappings.get(sku.value))
          .filter((mapping) => mapping?.status === "mapped" && mapping.supplierId !== null)
          .map((mapping) => mapping!.supplierId!),
      ),
    ];
    const supplierInfo = await this.suppliers.findByIds(organizationId, mappedSupplierIds);
    const draftRows = skus.flatMap((sku) => {
      const mapping = mappings.get(sku.value);
      if (mapping?.status !== "mapped" || mapping.supplierId === null) {
        return [];
      }
      return [{ supplierId: mapping.supplierId, sku }];
    });
    const draftPurchaseOrders = await this.openDraftPurchaseOrders.findOpenDraftsForSupplierSkus(
      organizationId,
      draftRows,
    );

    return {
      items: coreRows.map((row) => {
        const pack = packaging.get(row.sku.value);
        const policy = reorderPolicies.get(row.sku.value);
        const mapping = mappings.get(row.sku.value) ?? {
          status: "unmapped" as const,
          supplierId: null,
        };
        const supplier =
          mapping.supplierId === null ? undefined : supplierInfo.get(mapping.supplierId);
        const draftPurchaseOrder =
          mapping.supplierId === null
            ? null
            : (draftPurchaseOrders.get(uncoveredSkuDraftKey(mapping.supplierId, row.sku)) ??
              null);
        return {
          sku: row.sku,
          committed: row.committed,
          onHand: row.onHand,
          onOrder: row.onOrder,
          uncovered: row.uncovered,
          caseQty: pack?.caseQty ?? null,
          reorderMin: policy?.reorderMin ?? null,
          reorderMax: policy?.reorderMax ?? null,
          supplierId: mapping.supplierId,
          supplierNumber: supplier?.supplierNumber ?? null,
          supplierName: supplier?.supplierName ?? null,
          mappingStatus: mapping.status,
          draftPurchaseOrder,
        };
      }),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }
}
