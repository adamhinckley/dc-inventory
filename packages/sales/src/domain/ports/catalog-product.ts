import type {
  Money,
  OrganizationId,
  ProductId,
  Sku,
} from "@dc-inventory/shared-kernel";

export type ProductSnapshot = {
  productId: ProductId;
  organizationId: OrganizationId;
  sku: Sku;
  name: string;
  unitPrice: Money;
  taxCategoryCode?: string;
  active: boolean;
};

export interface ICatalogProductPort {
  findById(
    organizationId: OrganizationId,
    productId: ProductId,
  ): Promise<ProductSnapshot | null>;
}
