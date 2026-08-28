import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";

export type FactorySendCatalogRow = {
  readonly caseQty: number | null;
};

export interface IFactorySendCatalogPort {
  readBySkus(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, FactorySendCatalogRow>>;
}
