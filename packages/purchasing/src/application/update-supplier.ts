import type { OrganizationId, StaffUserId, SupplierId } from "@dc-inventory/shared-kernel";
import type { ISupplierRepository } from "../domain/ports/purchase-order-repository.js";
import { parsePoPrefix, type Supplier } from "../domain/supplier.js";

export type UpdateSupplierRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  supplierId: SupplierId;
  name?: string;
  vendorNumber?: string;
  poPrefix?: string | null;
};

export type UpdateSupplierResult =
  | { ok: true; supplier: Supplier }
  | {
      ok: false;
      reason: "not_found" | "invalid" | "duplicate_vendor_number" | "duplicate_po_prefix";
    };

export class UpdateSupplierUseCase {
  constructor(private readonly suppliers: ISupplierRepository) {}

  async execute(input: UpdateSupplierRequest): Promise<UpdateSupplierResult> {
    void input.staffUserId;
    const existing = await this.suppliers.findById(input.organizationId, input.supplierId);
    if (existing === null) {
      return { ok: false, reason: "not_found" };
    }
    const name = input.name === undefined ? existing.name : input.name.trim();
    const vendorNumber =
      input.vendorNumber === undefined ? existing.vendorNumber : input.vendorNumber.trim();
    if (name.length === 0 || vendorNumber.length === 0) {
      return { ok: false, reason: "invalid" };
    }
    const poPrefix =
      input.poPrefix === undefined ? existing.poPrefix : parsePoPrefix(input.poPrefix);
    if (poPrefix === "invalid") {
      return { ok: false, reason: "invalid" };
    }
    if (vendorNumber !== existing.vendorNumber) {
      const duplicate = await this.suppliers.findByVendorNumber(input.organizationId, vendorNumber);
      if (duplicate !== null && duplicate.id !== existing.id) {
        return { ok: false, reason: "duplicate_vendor_number" };
      }
    }
    if (poPrefix !== null && poPrefix !== existing.poPrefix) {
      const duplicatePrefix = await this.suppliers.findByPoPrefix(input.organizationId, poPrefix);
      if (duplicatePrefix !== null && duplicatePrefix.id !== existing.id) {
        return { ok: false, reason: "duplicate_po_prefix" };
      }
    }
    const supplier: Supplier = {
      id: existing.id,
      organizationId: existing.organizationId,
      name,
      vendorNumber,
      poPrefix,
    };
    await this.suppliers.save(supplier);
    return { ok: true, supplier };
  }
}
