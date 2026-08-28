import type { Sku, SupplierId } from "@dc-inventory/shared-kernel";
import type { SupplierProductId } from "./ids.js";

export type SupplierProduct = {
  readonly id: SupplierProductId;
  readonly supplierId: SupplierId;
  readonly sku: Sku;
  readonly supplierSku: string | null;
  readonly minOrderQty: number | null;
  readonly minOrderAmountCents: number | null;
  readonly lastPoCostCents: number | null;
  readonly currency: string;
};
