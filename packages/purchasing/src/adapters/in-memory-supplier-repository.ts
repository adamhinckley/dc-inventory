import { OrganizationId, SupplierId } from "@dc-inventory/shared-kernel";
import type { ISupplierRepository } from "../domain/ports/purchase-order-repository.js";
import type { Supplier } from "../domain/supplier.js";

function vendorKey(organizationId: OrganizationId, vendorNumber: string): string {
  return `${organizationId}:${vendorNumber}`;
}

export class InMemorySupplierRepository implements ISupplierRepository {
  private readonly byId = new Map<SupplierId, Supplier>();
  private readonly byVendorNumber = new Map<string, Supplier>();

  async findById(organizationId: OrganizationId, id: SupplierId): Promise<Supplier | null> {
    const supplier = this.byId.get(id);
    if (supplier === undefined || supplier.organizationId !== organizationId) {
      return null;
    }
    return supplier;
  }

  async findByVendorNumber(
    organizationId: OrganizationId,
    vendorNumber: string,
  ): Promise<Supplier | null> {
    return this.byVendorNumber.get(vendorKey(organizationId, vendorNumber)) ?? null;
  }

  async save(supplier: Supplier): Promise<void> {
    const normalized: Supplier = {
      id: SupplierId.parse(supplier.id),
      organizationId: OrganizationId.parse(supplier.organizationId),
      vendorNumber: supplier.vendorNumber,
      name: supplier.name,
    };
    this.byId.set(normalized.id, normalized);
    this.byVendorNumber.set(vendorKey(normalized.organizationId, normalized.vendorNumber), normalized);
  }

  async listAll(): Promise<readonly Supplier[]> {
    return [...this.byId.values()];
  }
}
