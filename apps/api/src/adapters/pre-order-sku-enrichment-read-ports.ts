import type {
  ISupplierRepository,
  ISupplierSkuMappingReadPort,
  IPreOrderOpenDraftPurchaseOrderReadPort,
} from "@dc-inventory/purchasing";
import type {
  IPreOrderSkuDraftPurchaseOrderReadPort,
  IPreOrderSkuSupplierMappingReadPort,
  IPreOrderSkuSupplierReadPort,
} from "@dc-inventory/inventory";
import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import { SupplierId } from "@dc-inventory/shared-kernel";

export function preOrderSkuSupplierMappingReadPort(
  supplierMapping: ISupplierSkuMappingReadPort,
): IPreOrderSkuSupplierMappingReadPort {
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

export function preOrderSkuSupplierReadPort(
  suppliers: ISupplierRepository,
): IPreOrderSkuSupplierReadPort {
  return {
    async findByIds(organizationId: OrganizationId, supplierIds: readonly SupplierId[]) {
      const info = new Map<
        string,
        {
          supplierId: SupplierId;
          supplierNumber: string;
          supplierName: string;
          poPrefix: string | null;
        }
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
          poPrefix: supplier.poPrefix,
        });
      }
      return info;
    },
  };
}

export function preOrderSkuDraftPurchaseOrderReadPort(
  openDraftPurchaseOrders: IPreOrderOpenDraftPurchaseOrderReadPort,
): IPreOrderSkuDraftPurchaseOrderReadPort {
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
