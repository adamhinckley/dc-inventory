import type { OrganizationId, StaffUserId, SupplierId } from "@dc-inventory/shared-kernel";
import { SupplierProductId } from "../domain/ids.js";
import type { ISupplierRepository } from "../domain/ports/purchase-order-repository.js";
import type { ISupplierProductRepository } from "../domain/ports/supplier-product-repository.js";
import type { SupplierProduct } from "../domain/supplier-product.js";

export type UpdateSupplierProductRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  supplierId: SupplierId;
  productId: SupplierProductId;
  supplierSku?: string | null;
  minOrderQty?: number | null;
  minOrderAmountCents?: number | null;
  lastPoCostCents?: number | null;
  currency?: string;
};

export type UpdateSupplierProductResult =
  | { ok: true; product: SupplierProduct }
  | { ok: false; reason: "not_found" | "invalid" };

export class UpdateSupplierProductUseCase {
  constructor(
    private readonly suppliers: ISupplierRepository,
    private readonly supplierProducts: ISupplierProductRepository,
  ) {}

  async execute(input: UpdateSupplierProductRequest): Promise<UpdateSupplierProductResult> {
    void input.staffUserId;
    const supplier = await this.suppliers.findById(input.organizationId, input.supplierId);
    if (supplier === null) {
      return { ok: false, reason: "not_found" };
    }
    const existing = await this.supplierProducts.findById(input.supplierId, input.productId);
    if (existing === null) {
      return { ok: false, reason: "not_found" };
    }
    const currency =
      input.currency === undefined
        ? existing.currency
        : input.currency.trim().toUpperCase();
    if (currency.length !== 3) {
      return { ok: false, reason: "invalid" };
    }
    const product: SupplierProduct = {
      ...existing,
      supplierSku:
        input.supplierSku === undefined
          ? existing.supplierSku
          : normalizeOptionalString(input.supplierSku),
      minOrderQty:
        input.minOrderQty === undefined ? existing.minOrderQty : normalizeOptionalInt(input.minOrderQty),
      minOrderAmountCents:
        input.minOrderAmountCents === undefined
          ? existing.minOrderAmountCents
          : normalizeOptionalInt(input.minOrderAmountCents),
      lastPoCostCents:
        input.lastPoCostCents === undefined
          ? existing.lastPoCostCents
          : normalizeOptionalInt(input.lastPoCostCents),
      currency,
    };
    if (
      input.minOrderQty !== undefined &&
      input.minOrderQty !== null &&
      product.minOrderQty === null
    ) {
      return { ok: false, reason: "invalid" };
    }
    if (
      input.minOrderAmountCents !== undefined &&
      input.minOrderAmountCents !== null &&
      product.minOrderAmountCents === null
    ) {
      return { ok: false, reason: "invalid" };
    }
    if (
      input.lastPoCostCents !== undefined &&
      input.lastPoCostCents !== null &&
      product.lastPoCostCents === null
    ) {
      return { ok: false, reason: "invalid" };
    }
    await this.supplierProducts.save(product);
    return { ok: true, product };
  }
}

function normalizeOptionalString(value: string | null): string | null {
  if (value === null) {
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
