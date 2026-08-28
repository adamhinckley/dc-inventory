import { Sku, type OrganizationId, type StaffUserId, type SupplierId } from "@dc-inventory/shared-kernel";
import { SupplierProductId, newUuid } from "../domain/ids.js";
import type { ISupplierRepository } from "../domain/ports/purchase-order-repository.js";
import type {
  ICatalogSkuLookupPort,
  ISupplierProductRepository,
} from "../domain/ports/supplier-product-repository.js";
import type { SupplierProduct } from "../domain/supplier-product.js";

export type AssignSupplierProductRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  supplierId: SupplierId;
  sku: string;
  supplierSku?: string | null;
  minOrderQty?: number | null;
  minOrderAmountCents?: number | null;
  lastPoCostCents?: number | null;
  currency?: string;
};

export type AssignSupplierProductResult =
  | { ok: true; product: SupplierProduct }
  | { ok: false; reason: "not_found" | "invalid" | "unknown_sku" | "duplicate_sku" };

export class AssignSupplierProductUseCase {
  constructor(
    private readonly suppliers: ISupplierRepository,
    private readonly supplierProducts: ISupplierProductRepository,
    private readonly catalog: ICatalogSkuLookupPort,
  ) {}

  async execute(input: AssignSupplierProductRequest): Promise<AssignSupplierProductResult> {
    void input.staffUserId;
    const supplier = await this.suppliers.findById(input.organizationId, input.supplierId);
    if (supplier === null) {
      return { ok: false, reason: "not_found" };
    }
    const skuValue = input.sku.trim();
    if (skuValue.length === 0) {
      return { ok: false, reason: "invalid" };
    }
    let sku: Sku;
    try {
      sku = Sku.parse(skuValue);
    } catch {
      return { ok: false, reason: "invalid" };
    }
    const catalogRow = await this.catalog.findBySku(input.organizationId, sku);
    if (catalogRow === null) {
      return { ok: false, reason: "unknown_sku" };
    }
    const existing = await this.supplierProducts.findBySupplierAndSku(input.supplierId, sku);
    if (existing !== null) {
      return { ok: false, reason: "duplicate_sku" };
    }
    const currency = (input.currency ?? "USD").trim().toUpperCase();
    if (currency.length !== 3) {
      return { ok: false, reason: "invalid" };
    }
    const product: SupplierProduct = {
      id: SupplierProductId.parse(newUuid()),
      supplierId: input.supplierId,
      sku,
      supplierSku: normalizeOptionalString(input.supplierSku),
      minOrderQty: normalizeOptionalInt(input.minOrderQty),
      minOrderAmountCents: normalizeOptionalInt(input.minOrderAmountCents),
      lastPoCostCents: normalizeOptionalInt(input.lastPoCostCents),
      currency,
    };
    await this.supplierProducts.save(product);
    return { ok: true, product };
  }
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeOptionalInt(value: number | null | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}
