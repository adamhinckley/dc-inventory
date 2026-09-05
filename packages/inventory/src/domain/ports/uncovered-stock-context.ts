import type { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";

export type UncoveredCaseQty = Readonly<{
  caseQty: number | null;
}>;

export type UncoveredReorderPolicy = Readonly<{
  reorderMin: number | null;
  reorderMax: number | null;
}>;

export interface IUncoveredCaseQtyReadPort {
  readBySkus(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, UncoveredCaseQty>>;
}

export interface IUncoveredReorderPolicyReadPort {
  readBySkus(
    organizationId: OrganizationId,
    locationId: LocationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, UncoveredReorderPolicy>>;
}
