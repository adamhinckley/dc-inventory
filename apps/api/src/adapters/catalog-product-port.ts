import type { IProductRepository, IQtyReadPort, Product } from "@dc-inventory/catalog";
import { wholesaleUnitPrice } from "@dc-inventory/catalog";
import type {
  ICatalogProductPort,
  ProductSnapshot,
} from "@dc-inventory/sales";
import type { OrganizationId, ProductId, Sku } from "@dc-inventory/shared-kernel";

function toSnapshot(
  product: Product,
  qty: { sellState: "open" | "locked"; availableToSell: number | null } | undefined,
): ProductSnapshot {
  return {
    productId: product.id,
    organizationId: product.organizationId,
    sku: product.sku,
    name: product.name,
    unitPrice: wholesaleUnitPrice(product),
    taxCategoryCode: product.taxCategoryCode ?? undefined,
    active: !product.inactive && !product.discontinued,
    ...(qty !== undefined
      ? { sellState: qty.sellState, availableToSell: qty.availableToSell }
      : {}),
  };
}

export function catalogProductPort(
  products: Pick<IProductRepository, "findById" | "findBySku">,
  qtyRead?: IQtyReadPort,
): ICatalogProductPort {
  async function withQty(product: Product): Promise<ProductSnapshot> {
    if (qtyRead === undefined) {
      return toSnapshot(product, undefined);
    }
    const qtyBySku = await qtyRead.readBySkus(product.organizationId, [product.sku]);
    return toSnapshot(product, qtyBySku.get(product.sku.value));
  }

  return {
    findById: async (
      organizationId: OrganizationId,
      productId: ProductId,
    ): Promise<ProductSnapshot | null> => {
      const product = await products.findById(organizationId, productId);
      if (product === null) {
        return null;
      }
      return withQty(product);
    },
    findBySku: async (
      organizationId: OrganizationId,
      sku: Sku,
    ): Promise<ProductSnapshot | null> => {
      const product = await products.findBySku(organizationId, sku);
      if (product === null) {
        return null;
      }
      return withQty(product);
    },
  };
}
