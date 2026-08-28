import type {
  IProductPackagingRepository,
  IProductRepository,
  IQtyReadPort,
} from "@dc-inventory/catalog";
import type {
  FactorySendCatalogRow,
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
      const result = new Map<string, FactorySendCatalogRow>();
      for (const sku of skus) {
        const product = await productRepo.findBySku(organizationId, sku);
        if (product === null) {
          result.set(sku.value, { caseQty: null });
          continue;
        }
        const pack = await packaging.findByProductId(product.id);
        result.set(sku.value, { caseQty: pack?.caseQty ?? null });
      }
      return result;
    },
  };
}
