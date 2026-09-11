import type {
  IProductPackagingRepository,
  IProductRepository,
  IQtyReadPort,
} from "@dc-inventory/catalog";
import { computeToOrder } from "@dc-inventory/inventory";
import type {
  ICatalogSkuLookupPort,
  IFactorySendCatalogPort,
  ISupplierProductQtyReadPort,
} from "@dc-inventory/purchasing";
import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import { readCaseQtyBySkus } from "./catalog-case-qty-by-skus.js";

function toCatalogSnapshot(product: {
  sku: Sku;
  name: string;
  inactive: boolean;
  discontinued: boolean;
}) {
  return {
    sku: product.sku,
    name: product.name,
    archived: product.inactive || product.discontinued,
  };
}

export function catalogSkuLookupPort(productRepo: IProductRepository): ICatalogSkuLookupPort {
  return {
    findBySku: async (organizationId: OrganizationId, sku: Sku) => {
      const product = await productRepo.findBySku(organizationId, sku);
      return product === null ? null : toCatalogSnapshot(product);
    },
    findBySkus: async (organizationId: OrganizationId, skus: readonly Sku[]) => {
      const products = await productRepo.findBySkus(organizationId, skus);
      const result = new Map<string, ReturnType<typeof toCatalogSnapshot>>();
      for (const [sku, product] of products) {
        result.set(sku, toCatalogSnapshot(product));
      }
      return result;
    },
  };
}

export function supplierProductQtyReadPort(qtyRead: IQtyReadPort): ISupplierProductQtyReadPort {
  return {
    async readBySkus(organizationId, skus) {
      const snapshots = await qtyRead.readBySkus(organizationId, skus);
      return new Map(
        [...snapshots.entries()].map(([sku, qty]) => [
          sku,
          {
            onHand: qty.onHand,
            onOrder: qty.onOrder,
            allocated: qty.allocated,
            available: qty.available,
            committed: qty.committed,
            toOrder: computeToOrder(qty.committed, qty.onHand, qty.onOrder),
          },
        ]),
      );
    },
  };
}

export function factorySendCatalogPort(
  productRepo: IProductRepository,
  packaging: IProductPackagingRepository,
): IFactorySendCatalogPort {
  return {
    readBySkus: (organizationId, skus) =>
      readCaseQtyBySkus(organizationId, skus, productRepo, packaging),
  };
}
