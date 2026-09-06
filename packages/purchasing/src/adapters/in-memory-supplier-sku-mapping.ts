import type { OrganizationId, Sku, SupplierId } from "@dc-inventory/shared-kernel";
import type { ISupplierSkuMappingReadPort } from "../domain/ports/supplier-sku-mapping.js";
import type { ISupplierRepository } from "../domain/ports/purchase-order-repository.js";
import {
  resolveSupplierSkuMapping,
  type SupplierSkuMapping,
} from "../domain/supplier-sku-mapping-status.js";
import type { InMemorySupplierProductRepository } from "./in-memory-supplier-product-repository.js";

export class InMemorySupplierSkuMappingReadPort implements ISupplierSkuMappingReadPort {
  constructor(
    private readonly suppliers: ISupplierRepository,
    private readonly supplierProducts: InMemorySupplierProductRepository,
  ) {}

  private async supplierIdsForSku(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<SupplierId[]> {
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
    return supplierIds;
  }

  async findSupplierForSku(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<SupplierId | null> {
    const mapping = await this.getSkuMapping(organizationId, sku);
    return mapping.supplierId;
  }

  async getSkuMapping(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<SupplierSkuMapping> {
    return resolveSupplierSkuMapping(await this.supplierIdsForSku(organizationId, sku));
  }

  async getSkuMappings(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, SupplierSkuMapping>> {
    const mappings = new Map<string, SupplierSkuMapping>();
    for (const sku of skus) {
      mappings.set(sku.value, await this.getSkuMapping(organizationId, sku));
    }
    return mappings;
  }
}
