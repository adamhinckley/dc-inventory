import { OrganizationId, StaffUserId, SupplierId } from "@dc-inventory/shared-kernel";
import { newUuid } from "../domain/ids.js";
import type { ISupplierRepository } from "../domain/ports/purchase-order-repository.js";
import { parsePoPrefix, type Supplier } from "../domain/supplier.js";

export type CreateSupplierRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  name: string;
  vendorNumber: string;
  poPrefix?: string | null;
};

export type CreateSupplierResult =
  | { ok: true; supplier: Supplier }
  | { ok: false; reason: "invalid" | "duplicate_vendor_number" | "duplicate_po_prefix" };

export class CreateSupplierUseCase {
  constructor(private readonly suppliers: ISupplierRepository) {}

  async execute(input: CreateSupplierRequest): Promise<CreateSupplierResult> {
    void input.staffUserId;
    const name = input.name.trim();
    const vendorNumber = input.vendorNumber.trim();
    if (name.length === 0 || vendorNumber.length === 0) {
      return { ok: false, reason: "invalid" };
    }
    const poPrefix = parsePoPrefix(input.poPrefix);
    if (poPrefix === "invalid") {
      return { ok: false, reason: "invalid" };
    }
    const existing = await this.suppliers.findByVendorNumber(input.organizationId, vendorNumber);
    if (existing !== null) {
      return { ok: false, reason: "duplicate_vendor_number" };
    }
    if (poPrefix !== null) {
      const duplicatePrefix = await this.suppliers.findByPoPrefix(input.organizationId, poPrefix);
      if (duplicatePrefix !== null) {
        return { ok: false, reason: "duplicate_po_prefix" };
      }
    }
    const supplier: Supplier = {
      id: SupplierId.parse(newUuid()),
      organizationId: input.organizationId,
      name,
      vendorNumber,
      poPrefix,
    };
    await this.suppliers.save(supplier);
    return { ok: true, supplier };
  }
}
