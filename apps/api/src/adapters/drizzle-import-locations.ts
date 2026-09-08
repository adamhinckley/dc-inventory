import type { OrganizationId } from "@dc-inventory/shared-kernel";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { IImportLocationPort, ImportLocationSeed } from "@dc-inventory/catalog";
import { locations } from "@dc-inventory/inventory/schema";

export type InventoryLocationsDrizzle = PostgresJsDatabase<{
  locations: typeof locations;
}>;

export class DrizzleImportLocationAdapter implements IImportLocationPort {
  constructor(private readonly db: InventoryLocationsDrizzle) {}

  async ensureLocations(
    organizationId: OrganizationId,
    locationSeeds: readonly ImportLocationSeed[],
  ): Promise<void> {
    if (locationSeeds.length === 0) {
      return;
    }
    await this.db
      .insert(locations)
      .values(
        locationSeeds.map((location) => ({
          organizationId,
          code: location.code,
          isPickBin: location.isPickBin,
        })),
      )
      .onConflictDoUpdate({
        target: [locations.organizationId, locations.code],
        set: {
          isPickBin: sql`(${locations.isPickBin} OR excluded.is_pick_bin)`,
          updatedAt: new Date(),
        },
      });
  }
}
