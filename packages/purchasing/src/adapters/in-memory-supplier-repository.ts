import { OrganizationId, SupplierId } from "@dc-inventory/shared-kernel";
import type {
  ISupplierRepository,
  ListSuppliersQuery,
  SupplierListPage,
} from "../domain/ports/purchase-order-repository.js";
import type { Supplier } from "../domain/supplier.js";

function vendorKey(organizationId: OrganizationId, vendorNumber: string): string {
  return `${organizationId}:${vendorNumber}`;
}

export class InMemorySupplierRepository implements ISupplierRepository {
  private readonly byId = new Map<SupplierId, Supplier>();
  private readonly byVendorNumber = new Map<string, Supplier>();

  async list(query: ListSuppliersQuery): Promise<SupplierListPage> {
    const needle = query.q?.trim().toLowerCase() ?? "";
    const rows = [...this.byId.values()].filter((supplier) => {
      if (supplier.organizationId !== query.organizationId) {
        return false;
      }
      if (needle.length === 0) {
        return true;
      }
      return (
        supplier.name.toLowerCase().includes(needle) ||
        supplier.vendorNumber.toLowerCase().includes(needle)
      );
    });
    rows.sort((a, b) => {
      const cmp =
        query.sortBy === "name"
          ? a.name.localeCompare(b.name)
          : a.vendorNumber.localeCompare(b.vendorNumber);
      return query.sortOrder === "desc" ? -cmp : cmp;
    });
    const start = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(start, start + query.pageSize),
      total: rows.length,
    };
  }

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
    const previous = this.byId.get(normalized.id);
    if (
      previous !== undefined &&
      (previous.organizationId !== normalized.organizationId ||
        previous.vendorNumber !== normalized.vendorNumber)
    ) {
      this.byVendorNumber.delete(vendorKey(previous.organizationId, previous.vendorNumber));
    }
    this.byId.set(normalized.id, normalized);
    this.byVendorNumber.set(vendorKey(normalized.organizationId, normalized.vendorNumber), normalized);
  }

  async listAll(): Promise<readonly Supplier[]> {
    return [...this.byId.values()];
  }
}
