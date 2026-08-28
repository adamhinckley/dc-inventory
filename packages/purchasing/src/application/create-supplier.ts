import { SupplierId, type OrganizationId, type StaffUserId } from "@dc-inventory/shared-kernel";
import { newUuid } from "../domain/ids.js";
import type { ISupplierRepository } from "../domain/ports/purchase-order-repository.js";
import type { Supplier } from "../domain/supplier.js";

export type CreateSupplierRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  name: string;
  vendorNumber: string;
};

export type CreateSupplierResult =
  | { ok: true; supplier: Supplier }
  | { ok: false; reason: "invalid" | "duplicate_vendor_number" };

export class CreateSupplierUseCase {
  constructor(private readonly suppliers: ISupplierRepository) {}

  async execute(input: CreateSupplierRequest): Promise<CreateSupplierResult> {
    void input.staffUserId;
    const name = input.name.trim();
    const vendorNumber = input.vendorNumber.trim();
    if (name.length === 0 || vendorNumber.length === 0) {
      return { ok: false, reason: "invalid" };
    }
    const existing = await this.suppliers.findByVendorNumber(input.organizationId, vendorNumber);
    if (existing !== null) {
      return { ok: false, reason: "duplicate_vendor_number" };
    }
    const supplier: Supplier = {
      id: SupplierId.parse(newUuid()),
      organizationId: input.organizationId,
      name,
      vendorNumber,
    };
    await this.suppliers.save(supplier);
    return { ok: true, supplier };
  }
}
