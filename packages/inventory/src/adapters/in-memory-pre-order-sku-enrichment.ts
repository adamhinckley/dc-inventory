import type { OrganizationId, Sku, SupplierId } from "@dc-inventory/shared-kernel";
import type {
  IPreOrderSkuDraftPurchaseOrderReadPort,
  IPreOrderSkuSupplierMappingReadPort,
  IPreOrderSkuSupplierReadPort,
  PreOrderSkuDraftPurchaseOrderRef,
  PreOrderSkuSupplierInfo,
  PreOrderSkuSupplierMapping,
  PreOrderSkuSupplierSku,
} from "../domain/ports/pre-order-sku-enrichment.js";
import { preOrderSkuDraftKey } from "../domain/ports/pre-order-sku-enrichment.js";

export class InMemoryPreOrderSkuSupplierMappingReadPort
  implements IPreOrderSkuSupplierMappingReadPort
{
  private readonly mappings = new Map<string, PreOrderSkuSupplierMapping>();

  set(organizationId: OrganizationId, sku: string, mapping: PreOrderSkuSupplierMapping): void {
    this.mappings.set(`${organizationId}:${sku}`, mapping);
  }

  async getSkuMappings(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, PreOrderSkuSupplierMapping>> {
    const result = new Map<string, PreOrderSkuSupplierMapping>();
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

export class InMemoryUncoveredSkuSupplierReadPort implements IPreOrderSkuSupplierReadPort {
  private readonly suppliers = new Map<string, PreOrderSkuSupplierInfo>();

  set(organizationId: OrganizationId, supplier: PreOrderSkuSupplierInfo): void {
    this.suppliers.set(`${organizationId}:${supplier.supplierId}`, supplier);
  }

  async findByIds(
    organizationId: OrganizationId,
    supplierIds: readonly SupplierId[],
  ): Promise<ReadonlyMap<string, PreOrderSkuSupplierInfo>> {
    const result = new Map<string, PreOrderSkuSupplierInfo>();
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
  implements IPreOrderSkuDraftPurchaseOrderReadPort
{
  private readonly drafts = new Map<string, PreOrderSkuDraftPurchaseOrderRef>();

  set(
    organizationId: OrganizationId,
    supplierId: SupplierId,
    sku: Sku,
    draft: PreOrderSkuDraftPurchaseOrderRef,
  ): void {
    this.drafts.set(`${organizationId}:${preOrderSkuDraftKey(supplierId, sku)}`, draft);
  }

  async findOpenDraftsForSupplierSkus(
    organizationId: OrganizationId,
    rows: readonly PreOrderSkuSupplierSku[],
  ): Promise<ReadonlyMap<string, PreOrderSkuDraftPurchaseOrderRef>> {
    const result = new Map<string, PreOrderSkuDraftPurchaseOrderRef>();
    for (const row of rows) {
      const draft = this.drafts.get(
        `${organizationId}:${preOrderSkuDraftKey(row.supplierId, row.sku)}`,
      );
      if (draft !== undefined) {
        result.set(preOrderSkuDraftKey(row.supplierId, row.sku), draft);
      }
    }
    return result;
  }
}
