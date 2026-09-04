import { Money, type OrganizationId, type ProductId, type Sku } from "@dc-inventory/shared-kernel";

export type Product = {
  id: ProductId;
  organizationId: OrganizationId;
  sku: Sku;
  name: string;
  description: string | null;
  uom: string;
  /** Master pack price from dump `mp_price` (case/carton price, not per sell unit). */
  memberPrice: Money;
  /** Wholesale list / per-unit sell price from dump `lp_price`. */
  listPrice: Money | null;
  inactive: boolean;
  discontinued: boolean;
  webWholesale: boolean;
  taxCategoryCode: string | null;
};

export function isShopVisible(product: Product): boolean {
  return product.webWholesale && !product.inactive && !product.discontinued;
}

/** Per-unit price for the wholesale shop and order line snapshots. */
export function wholesaleUnitPrice(product: Product): Money {
  if (product.listPrice !== null) {
    return product.listPrice;
  }
  return Money.fromMinorUnits(0, product.memberPrice.currency);
}
