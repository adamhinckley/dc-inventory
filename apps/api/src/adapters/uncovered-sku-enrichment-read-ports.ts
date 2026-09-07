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
import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import { SupplierId } from "@dc-inventory/shared-kernel";

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
      const info = new Map<
        string,
        { supplierId: SupplierId; supplierNumber: string; supplierName: string }
      >();
      if (supplierIds.length === 0) {
        return info;
      }
      const loaded = await suppliers.findByIds(organizationId, supplierIds);
      for (const [supplierId, supplier] of loaded) {
        info.set(supplierId, {
          supplierId: SupplierId.parse(supplierId),
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
