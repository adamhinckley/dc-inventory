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

function snapshotsFromProducts(
  products: ReadonlyMap<string, Product>,
  qtyBySku: ReadonlyMap<string, { sellState: "open" | "locked"; availableToSell: number | null }>,
  qtyRead: IQtyReadPort | undefined,
): ReadonlyMap<string, ProductSnapshot> {
  const result = new Map<string, ProductSnapshot>();
  for (const [productId, product] of products) {
    const qty =
      qtyRead === undefined ? undefined : qtyBySku.get(product.sku.value);
    result.set(productId, toSnapshot(product, qty));
  }
  return result;
}

export function catalogProductPort(
  products: Pick<IProductRepository, "findById" | "findByIds" | "findBySku">,
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
    findByIds: async (
      organizationId: OrganizationId,
      productIds: readonly ProductId[],
    ): Promise<ReadonlyMap<string, ProductSnapshot>> => {
      if (productIds.length === 0) {
        return new Map();
      }
      const loaded = await products.findByIds(organizationId, productIds);
      if (loaded.size === 0) {
        return new Map();
      }
      if (qtyRead === undefined) {
        return snapshotsFromProducts(loaded, new Map(), undefined);
      }
      const skus = [...loaded.values()].map((product) => product.sku);
      const qtyBySku = await qtyRead.readBySkus(organizationId, skus);
      return snapshotsFromProducts(loaded, qtyBySku, qtyRead);
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
