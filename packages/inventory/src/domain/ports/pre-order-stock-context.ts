import type { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";

export type PreOrderCaseQty = Readonly<{
  caseQty: number | null;
}>;

export type PreOrderReorderPolicy = Readonly<{
  reorderMin: number | null;
  reorderMax: number | null;
}>;

export interface IPreOrderCaseQtyReadPort {
  readBySkus(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, PreOrderCaseQty>>;
}

export interface IPreOrderReorderPolicyReadPort {
  readBySkus(
    organizationId: OrganizationId,
    locationId: LocationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, PreOrderReorderPolicy>>;
}
