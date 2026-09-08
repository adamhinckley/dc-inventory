import type { OrganizationId, Sku, SupplierId } from "@dc-inventory/shared-kernel";
import type { SupplierProductId } from "../ids.js";
import type { SupplierProduct } from "../supplier-product.js";

export type ListSupplierProductsQuery = {
  supplierId: SupplierId;
  q?: string;
  page: number;
  pageSize: number;
  sortBy?: "sku" | "supplierSku";
  sortOrder?: "asc" | "desc";
};

export type SupplierProductListPage = {
  items: readonly SupplierProduct[];
  total: number;
};

export type SupplierSkuPair = {
  supplierId: SupplierId;
  sku: Sku;
};

export interface ISupplierProductRepository {
  listBySupplier(query: ListSupplierProductsQuery): Promise<SupplierProductListPage>;
  findById(supplierId: SupplierId, id: SupplierProductId): Promise<SupplierProduct | null>;
  findBySupplierAndSku(supplierId: SupplierId, sku: Sku): Promise<SupplierProduct | null>;
  findBySupplierSkuPairs(pairs: readonly SupplierSkuPair[]): Promise<readonly SupplierProduct[]>;
  save(product: SupplierProduct): Promise<void>;
  saveMany(products: readonly SupplierProduct[]): Promise<void>;
  delete(supplierId: SupplierId, id: SupplierProductId): Promise<boolean>;
}

export type CatalogProductSnapshot = {
  sku: Sku;
  name: string;
  archived: boolean;
};

export interface ICatalogSkuLookupPort {
  findBySku(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<CatalogProductSnapshot | null>;
  findBySkus(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, CatalogProductSnapshot>>;
}

export interface ISupplierProductQtyReadPort {
  readBySkus(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, import("../qty.js").SupplierProductQty>>;
}
