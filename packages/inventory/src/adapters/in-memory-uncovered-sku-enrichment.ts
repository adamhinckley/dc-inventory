import type { OrganizationId, Sku, SupplierId } from "@dc-inventory/shared-kernel";
import type {
  IUncoveredSkuDraftPurchaseOrderReadPort,
  IUncoveredSkuSupplierMappingReadPort,
  IUncoveredSkuSupplierReadPort,
  UncoveredSkuDraftPurchaseOrderRef,
  UncoveredSkuSupplierInfo,
  UncoveredSkuSupplierMapping,
  UncoveredSkuSupplierSku,
} from "../domain/ports/uncovered-sku-enrichment.js";
import { uncoveredSkuDraftKey } from "../domain/ports/uncovered-sku-enrichment.js";

export class InMemoryUncoveredSkuSupplierMappingReadPort
  implements IUncoveredSkuSupplierMappingReadPort
{
  private readonly mappings = new Map<string, UncoveredSkuSupplierMapping>();

  set(organizationId: OrganizationId, sku: string, mapping: UncoveredSkuSupplierMapping): void {
    this.mappings.set(`${organizationId}:${sku}`, mapping);
  }

  async getSkuMappings(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, UncoveredSkuSupplierMapping>> {
    const result = new Map<string, UncoveredSkuSupplierMapping>();
    for (const sku of skus) {
      result.set(
        sku.value,
        this.mappings.get(`${organizationId}:${sku.value}`) ?? {
          status: "unmapped",
          supplierId: null,
        },
      );
    }
    return result;
  }
}

export class InMemoryUncoveredSkuSupplierReadPort implements IUncoveredSkuSupplierReadPort {
  private readonly suppliers = new Map<string, UncoveredSkuSupplierInfo>();

  set(organizationId: OrganizationId, supplier: UncoveredSkuSupplierInfo): void {
    this.suppliers.set(`${organizationId}:${supplier.supplierId}`, supplier);
  }

  async findByIds(
    organizationId: OrganizationId,
    supplierIds: readonly SupplierId[],
  ): Promise<ReadonlyMap<string, UncoveredSkuSupplierInfo>> {
    const result = new Map<string, UncoveredSkuSupplierInfo>();
    for (const supplierId of supplierIds) {
      const supplier = this.suppliers.get(`${organizationId}:${supplierId}`);
      if (supplier !== undefined) {
        result.set(supplierId, supplier);
      }
    }
    return result;
  }
}

export class InMemoryUncoveredSkuDraftPurchaseOrderReadPort
  implements IUncoveredSkuDraftPurchaseOrderReadPort
{
  private readonly drafts = new Map<string, UncoveredSkuDraftPurchaseOrderRef>();

  set(
    organizationId: OrganizationId,
    supplierId: SupplierId,
    sku: Sku,
    draft: UncoveredSkuDraftPurchaseOrderRef,
  ): void {
    this.drafts.set(`${organizationId}:${uncoveredSkuDraftKey(supplierId, sku)}`, draft);
  }

  async findOpenDraftsForSupplierSkus(
    organizationId: OrganizationId,
    rows: readonly UncoveredSkuSupplierSku[],
  ): Promise<ReadonlyMap<string, UncoveredSkuDraftPurchaseOrderRef>> {
    const result = new Map<string, UncoveredSkuDraftPurchaseOrderRef>();
    for (const row of rows) {
      const draft = this.drafts.get(
        `${organizationId}:${uncoveredSkuDraftKey(row.supplierId, row.sku)}`,
      );
      if (draft !== undefined) {
        result.set(uncoveredSkuDraftKey(row.supplierId, row.sku), draft);
      }
    }
    return result;
  }
}
