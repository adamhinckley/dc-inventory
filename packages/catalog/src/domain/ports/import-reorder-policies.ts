import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";

export type ImportReorderPolicySeed = {
  readonly sku: Sku;
  readonly reorderMin: number | null;
  readonly reorderMax: number | null;
};

export interface IImportReorderPolicyPort {
  upsertPolicies(
    organizationId: OrganizationId,
    policies: readonly ImportReorderPolicySeed[],
  ): Promise<void>;
}
