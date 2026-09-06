import type { SupplierId } from "@dc-inventory/shared-kernel";

export type SupplierSkuMappingStatus = "mapped" | "unmapped" | "ambiguous";

export type SupplierSkuMapping = Readonly<{
  status: SupplierSkuMappingStatus;
  supplierId: SupplierId | null;
}>;

export function resolveSupplierSkuMapping(
  supplierIds: readonly SupplierId[],
): SupplierSkuMapping {
  if (supplierIds.length === 0) {
    return { status: "unmapped", supplierId: null };
  }
  if (supplierIds.length === 1) {
    return { status: "mapped", supplierId: supplierIds[0] ?? null };
  }
  return { status: "ambiguous", supplierId: null };
}
