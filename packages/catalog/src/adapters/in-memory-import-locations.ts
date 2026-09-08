import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type {
  IImportLocationPort,
  ImportLocationSeed,
} from "../domain/ports/import-locations.js";

export class InMemoryImportLocationPort implements IImportLocationPort {
  readonly locations = new Map<string, ImportLocationSeed>();

  async ensureLocations(
    organizationId: OrganizationId,
    locations: readonly ImportLocationSeed[],
  ): Promise<void> {
    for (const location of locations) {
      const key = `${organizationId}:${location.code}`;
      const existing = this.locations.get(key);
      this.locations.set(key, {
        code: location.code,
        isPickBin: existing?.isPickBin === true || location.isPickBin,
      });
    }
  }
}
