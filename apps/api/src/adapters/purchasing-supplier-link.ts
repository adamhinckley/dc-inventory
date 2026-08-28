import type { ISupplierLinkPort, SupplierLinkRequest, SupplierLinkResult } from "@dc-inventory/catalog";
import {
  AssignSupplierProductUseCase,
  CreateSupplierUseCase,
  UpdateSupplierProductUseCase,
  UpdateSupplierUseCase,
  type ICatalogSkuLookupPort,
  type ISupplierProductRepository,
  type ISupplierRepository,
} from "@dc-inventory/purchasing";
import { Sku } from "@dc-inventory/shared-kernel";

export class PurchasingSupplierLinkAdapter implements ISupplierLinkPort {
  private readonly createSupplier: CreateSupplierUseCase;
  private readonly updateSupplier: UpdateSupplierUseCase;
  private readonly assignProduct: AssignSupplierProductUseCase;
  private readonly updateProduct: UpdateSupplierProductUseCase;

  constructor(
    private readonly suppliers: ISupplierRepository,
    private readonly supplierProducts: ISupplierProductRepository,
    catalog: ICatalogSkuLookupPort,
  ) {
    this.createSupplier = new CreateSupplierUseCase(suppliers);
    this.updateSupplier = new UpdateSupplierUseCase(suppliers);
    this.assignProduct = new AssignSupplierProductUseCase(suppliers, supplierProducts, catalog);
    this.updateProduct = new UpdateSupplierProductUseCase(suppliers, supplierProducts);
  }

  async linkSku(input: SupplierLinkRequest): Promise<SupplierLinkResult> {
    const existing = await this.suppliers.findByVendorNumber(
      input.organizationId,
      input.vendorNumber,
    );
    let supplierId = existing?.id;
    if (existing === null) {
      const created = await this.createSupplier.execute({
        organizationId: input.organizationId,
        staffUserId: input.staffUserId,
        name: input.vendorName,
        vendorNumber: input.vendorNumber,
      });
      if (!created.ok) {
        return { ok: false, message: "Vendor could not be created" };
      }
      supplierId = created.supplier.id;
    } else if (existing.name !== input.vendorName) {
      const updated = await this.updateSupplier.execute({
        organizationId: input.organizationId,
        staffUserId: input.staffUserId,
        supplierId: existing.id,
        name: input.vendorName,
      });
      if (!updated.ok) {
        return { ok: false, message: "Vendor could not be updated" };
      }
    }
    if (supplierId === undefined) {
      return { ok: false, message: "Vendor could not be created" };
    }

    const sku = Sku.parse(input.sku);
    const assigned = await this.supplierProducts.findBySupplierAndSku(supplierId, sku);
    if (assigned === null) {
      const result = await this.assignProduct.execute({
        organizationId: input.organizationId,
        staffUserId: input.staffUserId,
        supplierId,
        sku: input.sku,
        supplierSku: input.supplierSku,
        minOrderQty: input.minOrderQty,
        minOrderAmountCents: input.minOrderAmountCents,
        lastPoCostCents: input.lastPoCostCents,
      });
      if (!result.ok) {
        return { ok: false, message: "Vendor SKU could not be assigned" };
      }
      return { ok: true };
    }
    const updated = await this.updateProduct.execute({
      organizationId: input.organizationId,
      staffUserId: input.staffUserId,
      supplierId,
      productId: assigned.id,
      supplierSku: input.supplierSku,
      minOrderQty: input.minOrderQty,
      minOrderAmountCents: input.minOrderAmountCents,
      lastPoCostCents: input.lastPoCostCents,
    });
    if (!updated.ok) {
      return { ok: false, message: "Vendor SKU could not be updated" };
    }
    return { ok: true };
  }
}
