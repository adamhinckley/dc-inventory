import type {
  ISupplierRepository,
  ISupplierSkuMappingReadPort,
  IUncoveredOpenDraftPurchaseOrderReadPort,
} from "@dc-inventory/purchasing";
import type {
  IUncoveredSkuDraftPurchaseOrderReadPort,
  IUncoveredSkuSupplierMappingReadPort,
  IUncoveredSkuSupplierReadPort,
} from "@dc-inventory/inventory";
import type { OrganizationId, Sku, SupplierId } from "@dc-inventory/shared-kernel";

export function uncoveredSkuSupplierMappingReadPort(
  supplierMapping: ISupplierSkuMappingReadPort,
): IUncoveredSkuSupplierMappingReadPort {
  return {
    async getSkuMappings(organizationId: OrganizationId, skus: readonly Sku[]) {
      const mappings = await supplierMapping.getSkuMappings(organizationId, skus);
      return new Map(
        [...mappings.entries()].map(([sku, mapping]) => [
          sku,
          { status: mapping.status, supplierId: mapping.supplierId },
        ]),
      );
    },
  };
}

export function uncoveredSkuSupplierReadPort(
  suppliers: ISupplierRepository,
): IUncoveredSkuSupplierReadPort {
  return {
    async findByIds(organizationId: OrganizationId, supplierIds: readonly SupplierId[]) {
      const info = new Map<string, { supplierId: SupplierId; supplierNumber: string; supplierName: string }>();
      for (const supplierId of supplierIds) {
        const supplier = await suppliers.findById(organizationId, supplierId);
        if (supplier === null) {
          continue;
        }
        info.set(supplierId, {
          supplierId,
          supplierNumber: supplier.vendorNumber,
          supplierName: supplier.name,
        });
      }
      return info;
    },
  };
}

export function uncoveredSkuDraftPurchaseOrderReadPort(
  openDraftPurchaseOrders: IUncoveredOpenDraftPurchaseOrderReadPort,
): IUncoveredSkuDraftPurchaseOrderReadPort {
  return {
    async findOpenDraftsForSupplierSkus(organizationId, rows) {
      const refs = await openDraftPurchaseOrders.findOpenDraftsForSupplierSkus(
        organizationId,
        rows,
      );
      return new Map(
        [...refs.entries()].map(([key, ref]) => [
          key,
          { id: ref.id, documentNumber: ref.documentNumber },
        ]),
      );
    },
  };
}
