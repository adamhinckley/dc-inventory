import type { ISupplierRepository } from "../domain/ports/purchase-order-repository.js";
import type { PurchaseOrder } from "../domain/purchase-order.js";

export type PurchaseOrderSupplierLabels = {
  supplierName: string;
  supplierVendorNumber: string;
};

export async function labelsForSupplier(
  suppliers: ISupplierRepository,
  supplierId: PurchaseOrder["supplierId"],
): Promise<PurchaseOrderSupplierLabels> {
  const supplier = await suppliers.findById(supplierId);
  return {
    supplierName: supplier?.name ?? "",
    supplierVendorNumber: supplier?.vendorNumber ?? "",
  };
}
