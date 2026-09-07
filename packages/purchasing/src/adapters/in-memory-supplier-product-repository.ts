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
    const needle = query.q?.trim().toLowerCase() ?? "";
    const rows = [...this.byId.values()].filter((row) => {
      if (row.supplierId !== query.supplierId) {
        return false;
      }
      return (
        needle.length === 0 ||
        row.sku.value.toLowerCase().includes(needle) ||
        row.supplierSku?.toLowerCase().includes(needle) === true
      );
    });
    rows.sort((a, b) => {
      const cmp =
        query.sortBy === "supplierSku"
          ? (a.supplierSku ?? "").localeCompare(b.supplierSku ?? "")
          : a.sku.value.localeCompare(b.sku.value);
      return query.sortOrder === "desc" ? -cmp : cmp;
    });
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

  async findBySupplierSkuPairs(
    pairs: readonly { supplierId: SupplierId; sku: Sku }[],
  ): Promise<readonly SupplierProduct[]> {
    return pairs
      .map((pair) => this.bySupplierSku.get(this.supplierSkuKey(pair.supplierId, pair.sku)))
      .filter((row): row is SupplierProduct => row !== undefined);
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

  async saveMany(products: readonly SupplierProduct[]): Promise<void> {
    for (const product of products) {
      await this.save(product);
    }
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
