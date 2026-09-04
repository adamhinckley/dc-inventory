import type { IProductRepository } from "@dc-inventory/catalog";
import { wholesaleUnitPrice } from "@dc-inventory/catalog";
import type {
  ICatalogProductPort,
  ProductSnapshot,
} from "@dc-inventory/sales";

export function catalogProductPort(
  products: Pick<IProductRepository, "findById">,
): ICatalogProductPort {
  return {
    findById: async (organizationId, productId): Promise<ProductSnapshot | null> => {
      const product = await products.findById(organizationId, productId);
      if (product === null) {
        return null;
      }
      return {
        productId: product.id,
        organizationId: product.organizationId,
        sku: product.sku,
        name: product.name,
        unitPrice: wholesaleUnitPrice(product),
        taxCategoryCode: product.taxCategoryCode ?? undefined,
        active: !product.inactive && !product.discontinued,
      };
    },
  };
}
