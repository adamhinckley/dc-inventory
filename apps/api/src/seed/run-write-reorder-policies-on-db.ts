import { DrizzleProductRepository, type CatalogDrizzle } from "@dc-inventory/catalog";
import {
  DrizzleInventoryReadModel,
  PHASE2_DEFAULT_LOCATION_CODE,
} from "@dc-inventory/inventory";
import { locations } from "@dc-inventory/inventory/schema";
import { LocationId } from "@dc-inventory/shared-kernel";
import { eq } from "drizzle-orm";
import type { AppDrizzle } from "../infrastructure/db.js";
import type { DemoBookPlan } from "./planner/types.js";
import { DrizzleReorderPolicySeedRepository } from "./ports/drizzle-reorder-policy-seed.js";
import {
  runWriteReorderPolicies,
  type WriteReorderPoliciesResult,
} from "./write-reorder-policies.js";

/**
 * Postgres wiring for Demo reorder policies after document playback.
 */
export async function runWriteReorderPoliciesOnDb(
  db: AppDrizzle,
  plan: DemoBookPlan,
): Promise<WriteReorderPoliciesResult> {
  const locationRows = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.code, PHASE2_DEFAULT_LOCATION_CODE))
    .limit(1);
  const locationUuid = locationRows[0]?.id;
  if (locationUuid === undefined) {
    throw new Error("DEFAULT inventory location is missing; run Phase 2 bootstrap");
  }

  const resolveLocationUuid = async (locationId: LocationId): Promise<string> => {
    if (locationId === LocationId.DEFAULT || locationId === LocationId.parse(locationUuid)) {
      return locationUuid;
    }
    const rows = await db
      .select({ id: locations.id })
      .from(locations)
      .where(eq(locations.code, locationId))
      .limit(1);
    const id = rows[0]?.id;
    if (id === undefined) {
      throw new Error(`Unknown inventory location code ${locationId}`);
    }
    return id;
  };

  const readModel = new DrizzleInventoryReadModel(db as never, resolveLocationUuid);
  const products = new DrizzleProductRepository(db as CatalogDrizzle);
  const reorderPolicies = new DrizzleReorderPolicySeedRepository(db as never);

  return runWriteReorderPolicies(
    { products, inventoryReadModel: readModel, reorderPolicies },
    {
      plan,
      locationId: LocationId.parse(locationUuid),
    },
  );
}
