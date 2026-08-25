import { SupplierId } from "@dc-inventory/shared-kernel";
import type { ISupplierRepository } from "../domain/ports/purchase-order-repository.js";
import type { Supplier } from "../domain/supplier.js";

export class InMemorySupplierRepository implements ISupplierRepository {
  private readonly byId = new Map<SupplierId, Supplier>();
  private readonly byVendorNumber = new Map<string, Supplier>();

  async findById(id: SupplierId): Promise<Supplier | null> {
    return this.byId.get(id) ?? null;
  }

  async findByVendorNumber(vendorNumber: string): Promise<Supplier | null> {
    return this.byVendorNumber.get(vendorNumber) ?? null;
  }

  async save(supplier: Supplier): Promise<void> {
    const normalized: Supplier = {
      id: SupplierId.parse(supplier.id),
      vendorNumber: supplier.vendorNumber,
      name: supplier.name,
    };
    this.byId.set(normalized.id, normalized);
    this.byVendorNumber.set(normalized.vendorNumber, normalized);
  }

  async listAll(): Promise<readonly Supplier[]> {
    return [...this.byId.values()];
  }
}
