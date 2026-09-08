import type { AppDrizzle } from "../infrastructure/db.js";
import type {
  IImportReorderPolicyPort,
  ImportReorderPolicySeed,
} from "@dc-inventory/catalog";
import { locations, reorderPolicies } from "@dc-inventory/inventory/schema";
import type { OrganizationId } from "@dc-inventory/shared-kernel";
import { and, eq, sql } from "drizzle-orm";

const IMPORT_BATCH_SIZE = 500;

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

const DEFAULT_LOCATION_CODE = "DEFAULT";

export class DrizzleImportReorderPolicyAdapter implements IImportReorderPolicyPort {
  constructor(private readonly db: AppDrizzle) {}

  async upsertPolicies(
    organizationId: OrganizationId,
    policies: readonly ImportReorderPolicySeed[],
  ): Promise<void> {
    if (policies.length === 0) {
      return;
    }
    const locationRows = await this.db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.organizationId, organizationId),
          eq(locations.code, DEFAULT_LOCATION_CODE),
        ),
      )
      .limit(1);
    let locationId = locationRows[0]?.id;
    if (locationId === undefined) {
      const inserted = await this.db
        .insert(locations)
        .values({
          organizationId,
          code: DEFAULT_LOCATION_CODE,
          isPickBin: false,
        })
        .returning({ id: locations.id });
      locationId = inserted[0]?.id;
      if (locationId === undefined) {
        throw new Error("Default location could not be created");
      }
    }
    for (const batch of chunks(policies, IMPORT_BATCH_SIZE)) {
      await this.db
        .insert(reorderPolicies)
        .values(
          batch.map((policy) => ({
            organizationId,
            locationId,
            sku: policy.sku.value,
            minOnHand: policy.reorderMin ?? 0,
            maxOnHand: policy.reorderMax ?? 0,
          })),
        )
        .onConflictDoUpdate({
          target: [
            reorderPolicies.organizationId,
            reorderPolicies.locationId,
            reorderPolicies.sku,
          ],
          set: {
            minOnHand: sql`excluded.min_on_hand`,
            maxOnHand: sql`excluded.max_on_hand`,
          },
        });
    }
  }
}
