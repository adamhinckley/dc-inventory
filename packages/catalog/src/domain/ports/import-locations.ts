import type { OrganizationId } from "@dc-inventory/shared-kernel";

export type ImportLocationSeed = {
  readonly code: string;
  readonly isPickBin: boolean;
};

export interface IImportLocationPort {
  ensureLocations(
    organizationId: OrganizationId,
    locations: readonly ImportLocationSeed[],
  ): Promise<void>;
}
