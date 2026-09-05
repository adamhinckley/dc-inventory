import type { OrganizationId, Sku, SupplierId } from "@dc-inventory/shared-kernel";
import type { ISupplierSkuMappingReadPort } from "../domain/ports/supplier-sku-mapping.js";
import type { ISupplierRepository } from "../domain/ports/purchase-order-repository.js";
import type { InMemorySupplierProductRepository } from "./in-memory-supplier-product-repository.js";

export class InMemorySupplierSkuMappingReadPort implements ISupplierSkuMappingReadPort {
  constructor(
    private readonly suppliers: ISupplierRepository,
    private readonly supplierProducts: InMemorySupplierProductRepository,
  ) {}

  async findSupplierForSku(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<SupplierId | null> {
    const matches = (await this.supplierProducts.listAll()).filter(
      (row) => row.sku.value === sku.value,
    );
    const supplierIds: SupplierId[] = [];
    for (const row of matches) {
      const supplier = await this.suppliers.findById(organizationId, row.supplierId);
      if (supplier !== null) {
        supplierIds.push(row.supplierId);
      }
    }
    if (supplierIds.length !== 1) {
      return null;
    }
    return supplierIds[0] ?? null;
  }
}
