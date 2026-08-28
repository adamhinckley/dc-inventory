import type {
  IProductPackagingRepository,
  IProductRepository,
  IQtyReadPort,
} from "@dc-inventory/catalog";
import type {
  ICatalogSkuLookupPort,
  IFactorySendCatalogPort,
  ISupplierProductQtyReadPort,
} from "@dc-inventory/purchasing";
import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";

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

export function factorySendCatalogPort(
  productRepo: IProductRepository,
  packaging: IProductPackagingRepository,
): IFactorySendCatalogPort {
  return {
    async readBySkus(organizationId: OrganizationId, skus: readonly Sku[]) {
      const uniqueSkus = [...new Map(skus.map((sku) => [sku.value, sku])).values()];
      const rows = await Promise.all(
        uniqueSkus.map(async (sku) => {
          const product = await productRepo.findBySku(organizationId, sku);
          if (product === null) {
            return [sku.value, { caseQty: null }] as const;
          }
          const pack = await packaging.findByProductId(product.id);
          return [sku.value, { caseQty: pack?.caseQty ?? null }] as const;
        }),
      );
      return new Map(rows);
    },
  };
}
