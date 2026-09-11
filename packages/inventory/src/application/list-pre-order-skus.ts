import { LocationId, OrganizationId, requireOrganizationId, type Sku, type SupplierId } from "@dc-inventory/shared-kernel";
import type {
  IPreOrderListQuery,
  PreOrderListCoreRow,
  PreOrderListRow,
} from "../domain/ports/pre-order-list-query.js";
import type {
  IPreOrderCaseQtyReadPort,
  IPreOrderReorderPolicyReadPort,
} from "../domain/ports/pre-order-stock-context.js";
import type {
  IPreOrderSkuDraftPurchaseOrderReadPort,
  IPreOrderSkuSupplierMappingReadPort,
  IPreOrderSkuSupplierReadPort,
} from "../domain/ports/pre-order-sku-enrichment.js";
import { preOrderSkuDraftKey } from "../domain/ports/pre-order-sku-enrichment.js";

export type ListPreOrderSkusRequest = {
  organizationId: OrganizationId;
  locationId?: LocationId;
  page: number;
  pageSize: number;
  supplierId?: SupplierId;
  needsMapping?: boolean;
};

export type ListPreOrderSkusResult = {
  items: PreOrderListRow[];
  page: number;
  pageSize: number;
  total: number;
};

export class ListPreOrderSkusUseCase {
  constructor(
    private readonly preOrderList: IPreOrderListQuery,
    private readonly caseQty: IPreOrderCaseQtyReadPort,
    private readonly reorderPolicies: IPreOrderReorderPolicyReadPort,
    private readonly supplierMapping: IPreOrderSkuSupplierMappingReadPort,
    private readonly suppliers: IPreOrderSkuSupplierReadPort,
    private readonly openDraftPurchaseOrders: IPreOrderSkuDraftPurchaseOrderReadPort,
  ) {}

  async execute(input: ListPreOrderSkusRequest): Promise<ListPreOrderSkusResult> {
    const organizationId = requireOrganizationId(input.organizationId);
    const resolvedLocationId = input.locationId ?? LocationId.DEFAULT;

    const page = await this.preOrderList.list({
      organizationId,
      locationId: resolvedLocationId,
      page: input.page,
      pageSize: input.pageSize,
      supplierId: input.supplierId,
      needsMapping: input.needsMapping,
    });
    const coreRows: readonly PreOrderListCoreRow[] = page.items;
    const total = page.total;

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
            : (draftPurchaseOrders.get(preOrderSkuDraftKey(mapping.supplierId, row.sku)) ??
              null);
        return {
          sku: row.sku,
          committed: row.committed,
          onHand: row.onHand,
          onOrder: row.onOrder,
          toOrder: row.toOrder,
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
