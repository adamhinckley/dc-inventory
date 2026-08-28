import type { IProductRepository } from "@dc-inventory/catalog";
import type {
  ICatalogSkuLookupPort,
  ISupplierProductQtyReadPort,
} from "@dc-inventory/purchasing";
import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import type { IQtyReadPort } from "@dc-inventory/catalog";

export function catalogSkuLookupPort(productRepo: IProductRepository): ICatalogSkuLookupPort {
  return {
    findBySku: async (organizationId: OrganizationId, sku: Sku) => {
      const product = await productRepo.findBySku(organizationId, sku);
      return product === null ? null : { name: product.name };
    },
  };
}

export function supplierProductQtyReadPort(qtyRead: IQtyReadPort): ISupplierProductQtyReadPort {
  return {
    readBySkus: (organizationId, skus) => qtyRead.readBySkus(organizationId, skus),
  };
}
