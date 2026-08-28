import type { OrganizationId, Sku, SupplierId } from "@dc-inventory/shared-kernel";
import type { SupplierProductId } from "../ids.js";
import type { SupplierProduct } from "../supplier-product.js";

export type ListSupplierProductsQuery = {
  supplierId: SupplierId;
  page: number;
  pageSize: number;
};

export type SupplierProductListPage = {
  items: readonly SupplierProduct[];
  total: number;
};

export interface ISupplierProductRepository {
  listBySupplier(query: ListSupplierProductsQuery): Promise<SupplierProductListPage>;
  findById(supplierId: SupplierId, id: SupplierProductId): Promise<SupplierProduct | null>;
  findBySupplierAndSku(supplierId: SupplierId, sku: Sku): Promise<SupplierProduct | null>;
  save(product: SupplierProduct): Promise<void>;
  delete(supplierId: SupplierId, id: SupplierProductId): Promise<boolean>;
}

export interface ICatalogSkuLookupPort {
  findBySku(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<{ name: string } | null>;
}

export interface ISupplierProductQtyReadPort {
  readBySkus(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, import("../qty.js").SupplierProductQty>>;
}
