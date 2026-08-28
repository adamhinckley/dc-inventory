import { Sku, SupplierId } from "@dc-inventory/shared-kernel";
import { SupplierProductId } from "../domain/ids.js";
import type {
  ISupplierProductRepository,
  ListSupplierProductsQuery,
  SupplierProductListPage,
} from "../domain/ports/supplier-product-repository.js";
import type { SupplierProduct } from "../domain/supplier-product.js";

export class InMemorySupplierProductRepository implements ISupplierProductRepository {
  private readonly byId = new Map<SupplierProductId, SupplierProduct>();
  private readonly bySupplierSku = new Map<string, SupplierProduct>();

  private supplierSkuKey(supplierId: SupplierId, sku: Sku): string {
    return `${supplierId}:${sku.value}`;
  }

  async listBySupplier(query: ListSupplierProductsQuery): Promise<SupplierProductListPage> {
    const rows = [...this.byId.values()].filter(
      (row) => row.supplierId === query.supplierId,
    );
    rows.sort((a, b) => a.sku.value.localeCompare(b.sku.value));
    const start = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(start, start + query.pageSize),
      total: rows.length,
    };
  }

  async findById(
    supplierId: SupplierId,
    id: SupplierProductId,
  ): Promise<SupplierProduct | null> {
    const row = this.byId.get(id);
    if (row === undefined || row.supplierId !== supplierId) {
      return null;
    }
    return row;
  }

  async findBySupplierAndSku(
    supplierId: SupplierId,
    sku: Sku,
  ): Promise<SupplierProduct | null> {
    return this.bySupplierSku.get(this.supplierSkuKey(supplierId, sku)) ?? null;
  }

  async save(product: SupplierProduct): Promise<void> {
    const normalized: SupplierProduct = {
      id: SupplierProductId.parse(product.id),
      supplierId: SupplierId.parse(product.supplierId),
      sku: Sku.parse(product.sku.value),
      supplierSku: product.supplierSku,
      minOrderQty: product.minOrderQty,
      minOrderAmountCents: product.minOrderAmountCents,
      lastPoCostCents: product.lastPoCostCents,
      currency: product.currency,
    };
    const previous = this.byId.get(normalized.id);
    if (previous !== undefined) {
      this.bySupplierSku.delete(this.supplierSkuKey(previous.supplierId, previous.sku));
    }
    this.byId.set(normalized.id, normalized);
    this.bySupplierSku.set(this.supplierSkuKey(normalized.supplierId, normalized.sku), normalized);
  }

  async delete(supplierId: SupplierId, id: SupplierProductId): Promise<boolean> {
    const existing = await this.findById(supplierId, id);
    if (existing === null) {
      return false;
    }
    this.byId.delete(id);
    this.bySupplierSku.delete(this.supplierSkuKey(existing.supplierId, existing.sku));
    return true;
  }

  async listAll(): Promise<readonly SupplierProduct[]> {
    return [...this.byId.values()];
  }
}
