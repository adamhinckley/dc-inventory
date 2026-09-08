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
  /** Omitted on snapshots that do not carry inventory qty (open / no cap). */
  sellState?: "open" | "locked";
  availableToSell?: number | null;
  stickyLocked?: boolean;
  windowOpensAt?: Date | null;
  windowClosesAt?: Date | null;
  hasActiveSellWindowMembership?: boolean;
};

export interface ICatalogProductPort {
  findById(
    organizationId: OrganizationId,
    productId: ProductId,
  ): Promise<ProductSnapshot | null>;
  findByIds(
    organizationId: OrganizationId,
    productIds: readonly ProductId[],
  ): Promise<ReadonlyMap<string, ProductSnapshot>>;
  findBySku(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<ProductSnapshot | null>;
}
