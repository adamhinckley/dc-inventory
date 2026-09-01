import type { Money, OrganizationId, ProductId, Sku } from "@dc-inventory/shared-kernel";

export type Product = {
  id: ProductId;
  organizationId: OrganizationId;
  sku: Sku;
  name: string;
  description: string | null;
  uom: string;
  masterPackPrice: Money;
  inactive: boolean;
  discontinued: boolean;
  webWholesale: boolean;
  taxCategoryCode: string | null;
};

export function isShopVisible(product: Product): boolean {
  return product.webWholesale && !product.inactive && !product.discontinued;
}
