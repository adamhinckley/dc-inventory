import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { reorderPolicies } from "@dc-inventory/inventory/schema";
import { DEMO_SEED_ORGANIZATION_ID } from "../demo-seed-organization.js";
import type {
  IReorderPolicySeedRepository,
  ReorderPolicySeedRow,
} from "./static-seed-types.js";

export type InventoryReorderPolicyDrizzle = PostgresJsDatabase<{
  reorderPolicies: typeof reorderPolicies;
}>;

export class DrizzleReorderPolicySeedRepository implements IReorderPolicySeedRepository {
  constructor(private readonly db: InventoryReorderPolicyDrizzle) {}

  async save(row: ReorderPolicySeedRow): Promise<void> {
    const existing = await this.db
      .select({ id: reorderPolicies.id })
      .from(reorderPolicies)
      .where(
        and(
          eq(reorderPolicies.organizationId, DEMO_SEED_ORGANIZATION_ID),
          eq(reorderPolicies.sku, row.sku),
          eq(reorderPolicies.locationId, row.locationId),
        ),
      )
      .limit(1);
    if (existing[0] !== undefined) {
      await this.db
        .update(reorderPolicies)
        .set({
          minOnHand: row.minOnHand,
          maxOnHand: row.maxOnHand,
          updatedAt: new Date(),
        })
        .where(eq(reorderPolicies.id, existing[0].id));
      return;
    }
    await this.db.insert(reorderPolicies).values({
      organizationId: DEMO_SEED_ORGANIZATION_ID,
      sku: row.sku,
      locationId: row.locationId,
      minOnHand: row.minOnHand,
      maxOnHand: row.maxOnHand,
    });
  }

  async listAll(): Promise<readonly ReorderPolicySeedRow[]> {
    const rows = await this.db
      .select({
        sku: reorderPolicies.sku,
        locationId: reorderPolicies.locationId,
        minOnHand: reorderPolicies.minOnHand,
        maxOnHand: reorderPolicies.maxOnHand,
      })
      .from(reorderPolicies)
      .where(eq(reorderPolicies.organizationId, DEMO_SEED_ORGANIZATION_ID));
    return rows.map((row) => ({
      sku: row.sku,
      locationId: row.locationId,
      minOnHand: row.minOnHand,
      maxOnHand: row.maxOnHand,
    }));
  }
}
