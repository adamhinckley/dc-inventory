import type {
  InMemorySupplierProductRepository,
  ISupplierRepository,
} from "@dc-inventory/purchasing";
import type {
  IProductPrimarySupplierReadPort,
  ProductPrimarySupplierTerms,
} from "@dc-inventory/catalog";
import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";

export class InMemoryPurchasingProductPrimarySupplierReadAdapter
  implements IProductPrimarySupplierReadPort
{
  constructor(
    private readonly suppliers: ISupplierRepository,
    private readonly supplierProducts: InMemorySupplierProductRepository,
  ) {}

  async findByCatalogSku(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<ProductPrimarySupplierTerms | null> {
    const row = (await this.supplierProducts.listAll()).find(
      (product) => product.sku.value === sku.value,
    );
    if (row === undefined) {
      return null;
    }
    const supplier = await this.suppliers.findById(organizationId, row.supplierId);
    if (supplier === null || supplier.organizationId !== organizationId) {
      return null;
    }
    return {
      vendorNumber: supplier.vendorNumber,
      vendorName: supplier.name,
      supplierSku: normalizeOptional(row.supplierSku),
      minOrderQty: row.minOrderQty,
      minOrderAmountCents: row.minOrderAmountCents,
      lastPoCostCents: row.lastPoCostCents,
    };
  }
}

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}
