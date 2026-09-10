import type {
  IProductPackagingRepository,
  IProductRepository,
  IQtyReadPort,
} from "@dc-inventory/catalog";
import { computeUncovered } from "@dc-inventory/inventory";
import type {
  ICatalogSkuLookupPort,
  IFactorySendCatalogPort,
  ISupplierProductQtyReadPort,
} from "@dc-inventory/purchasing";
import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";

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
            uncovered: computeUncovered(qty.committed, qty.onHand, qty.onOrder),
          },
        ]),
      );
    },
  };
}

function uniqueSkus(skus: readonly Sku[]): Sku[] {
  return [...new Map(skus.map((sku) => [sku.value, sku])).values()];
}

export function factorySendCatalogPort(
  productRepo: IProductRepository,
  packaging: IProductPackagingRepository,
): IFactorySendCatalogPort {
  return {
    async readBySkus(organizationId: OrganizationId, skus: readonly Sku[]) {
      const values = uniqueSkus(skus);
      const rows = new Map<string, { caseQty: number | null }>();
      for (const sku of values) {
        rows.set(sku.value, { caseQty: null });
      }
      if (values.length === 0) {
        return rows;
      }

      const products = await productRepo.findBySkus(organizationId, values);
      const productIds = [...new Set([...products.values()].map((product) => product.id))];
      const packagingByProductId = await packaging.findByProductIds(productIds);

      for (const sku of values) {
        const product = products.get(sku.value);
        if (product === undefined) {
          continue;
        }
        rows.set(sku.value, {
          caseQty: packagingByProductId.get(product.id)?.caseQty ?? null,
        });
      }
      return rows;
    },
  };
}
