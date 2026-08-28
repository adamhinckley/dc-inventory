import type { OrganizationId, StaffUserId, SupplierId } from "@dc-inventory/shared-kernel";
import type { ISupplierRepository } from "../domain/ports/purchase-order-repository.js";
import type { Supplier } from "../domain/supplier.js";

export type GetSupplierRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  supplierId: SupplierId;
};

export type GetSupplierResult =
  | { ok: true; supplier: Supplier }
  | { ok: false; reason: "not_found" };

export class GetSupplierUseCase {
  constructor(private readonly suppliers: ISupplierRepository) {}

  async execute(input: GetSupplierRequest): Promise<GetSupplierResult> {
    void input.staffUserId;
    const supplier = await this.suppliers.findById(input.organizationId, input.supplierId);
    if (supplier === null) {
      return { ok: false, reason: "not_found" };
    }
    return { ok: true, supplier };
  }
}
