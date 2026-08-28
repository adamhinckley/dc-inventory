import type { OrganizationId, StaffUserId, SupplierId } from "@dc-inventory/shared-kernel";
import type { SupplierProductId } from "../domain/ids.js";
import type { ISupplierRepository } from "../domain/ports/purchase-order-repository.js";
import type { ISupplierProductRepository } from "../domain/ports/supplier-product-repository.js";

export type UnlinkSupplierProductRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  supplierId: SupplierId;
  productId: SupplierProductId;
};

export type UnlinkSupplierProductResult =
  | { ok: true }
  | { ok: false; reason: "not_found" };

export class UnlinkSupplierProductUseCase {
  constructor(
    private readonly suppliers: ISupplierRepository,
    private readonly supplierProducts: ISupplierProductRepository,
  ) {}

  async execute(input: UnlinkSupplierProductRequest): Promise<UnlinkSupplierProductResult> {
    void input.staffUserId;
    const supplier = await this.suppliers.findById(input.organizationId, input.supplierId);
    if (supplier === null) {
      return { ok: false, reason: "not_found" };
    }
    const existing = await this.supplierProducts.findById(input.supplierId, input.productId);
    if (existing === null) {
      return { ok: false, reason: "not_found" };
    }
    const deleted = await this.supplierProducts.delete(input.supplierId, input.productId);
    if (!deleted) {
      return { ok: false, reason: "not_found" };
    }
    return { ok: true };
  }
}
