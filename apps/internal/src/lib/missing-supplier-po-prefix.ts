import { getInternalSupplier } from "@dc-inventory/api-client-internal";
import type { SupplierDetail } from "./supplier-types";

export function isSupplierPoPrefixMissing(poPrefix: string | null | undefined): boolean {
  return poPrefix === null || poPrefix === undefined || poPrefix.trim().length === 0;
}

function supplierDetailWhenLookupFailed(id: string): SupplierDetail {
  return {
    id,
    vendorNumber: "",
    name: "Vendor",
    poPrefix: null,
  };
}

export async function loadSuppliersMissingPoPrefix(
  supplierIds: readonly (string | null | undefined)[],
): Promise<SupplierDetail[]> {
  const unique = [
    ...new Set(
      supplierIds.filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const missing: SupplierDetail[] = [];
  for (const id of unique) {
    const result = await getInternalSupplier(id);
    if (result.status !== 200) {
      missing.push(supplierDetailWhenLookupFailed(id));
      continue;
    }
    if (isSupplierPoPrefixMissing(result.data.poPrefix)) {
      missing.push(result.data);
    }
  }
  return missing;
}
