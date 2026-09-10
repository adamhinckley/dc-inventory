import type { OrganizationId, StaffUserId, SupplierId } from "@dc-inventory/shared-kernel";
import type { ISupplierRepository } from "../domain/ports/purchase-order-repository.js";
import type { IFactorySendCatalogPort } from "../domain/ports/factory-send-catalog.js";
import type {
  ICatalogSkuLookupPort,
  ISupplierProductQtyReadPort,
  ISupplierProductRepository,
} from "../domain/ports/supplier-product-repository.js";
import { ZERO_SUPPLIER_PRODUCT_QTY, type SupplierProductQty } from "../domain/qty.js";
import type { SupplierProductId } from "../domain/ids.js";

export type SupplierProductListRow = {
  id: SupplierProductId;
  sku: string;
  catalogName: string;
  supplierSku: string | null;
  minOrderQty: number | null;
  minOrderAmountCents: number | null;
  lastPoCostCents: number | null;
  currency: string;
  caseQty: number | null;
  qty: SupplierProductQty;
};

export type ListSupplierProductsRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  supplierId: SupplierId;
  q?: string;
  page: number;
  pageSize: number;
  sortBy?: "sku" | "supplierSku";
  sortOrder?: "asc" | "desc";
};

export type ListSupplierProductsResult =
  | {
      ok: true;
      items: SupplierProductListRow[];
      page: number;
      pageSize: number;
      total: number;
    }
  | { ok: false; reason: "not_found" };

export class ListSupplierProductsUseCase {
  constructor(
    private readonly suppliers: ISupplierRepository,
    private readonly supplierProducts: ISupplierProductRepository,
    private readonly catalog: ICatalogSkuLookupPort,
    private readonly qty: ISupplierProductQtyReadPort,
    private readonly factorySendCatalog: IFactorySendCatalogPort,
  ) {}

  async execute(input: ListSupplierProductsRequest): Promise<ListSupplierProductsResult> {
    void input.staffUserId;
    const supplier = await this.suppliers.findById(input.organizationId, input.supplierId);
    if (supplier === null) {
      return { ok: false, reason: "not_found" };
    }
    const page = await this.supplierProducts.listBySupplier({
      supplierId: input.supplierId,
      q: input.q,
      page: input.page,
      pageSize: input.pageSize,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
    });
    const pageSkus = page.items.map((row) => row.sku);
    const [snapshots, names, packaging] = await Promise.all([
      this.qty.readBySkus(input.organizationId, pageSkus),
      this.catalog.findBySkus(input.organizationId, pageSkus),
      this.factorySendCatalog.readBySkus(input.organizationId, pageSkus),
    ]);
    const items: SupplierProductListRow[] = page.items.map((row) => ({
      id: row.id,
      sku: row.sku.value,
      catalogName: names.get(row.sku.value)?.name ?? row.sku.value,
      supplierSku: row.supplierSku,
      minOrderQty: row.minOrderQty,
      minOrderAmountCents: row.minOrderAmountCents,
      lastPoCostCents: row.lastPoCostCents,
      currency: row.currency,
      caseQty: packaging.get(row.sku.value)?.caseQty ?? null,
      qty: snapshots.get(row.sku.value) ?? ZERO_SUPPLIER_PRODUCT_QTY,
    }));
    return {
      ok: true,
      items,
      page: input.page,
      pageSize: input.pageSize,
      total: page.total,
    };
  }
}
