import { and, eq } from "drizzle-orm";
import {
  PHASE2_DEFAULT_LOCATION_CODE,
  PHASE2_SUPPLIER_NAME,
  PHASE2_SUPPLIER_VENDOR_NUMBER,
  runPhase2Bootstrap,
  type Phase2BootstrapPorts,
} from "@dc-inventory/inventory";
import { locations } from "@dc-inventory/inventory/schema";
import { suppliers } from "@dc-inventory/purchasing/schema";
import type { AppDrizzle } from "../infrastructure/db.js";
import { DEMO_SEED_ORGANIZATION_ID } from "./demo-seed-organization.js";

export async function runPhase2BootstrapOnDb(db: AppDrizzle) {
  const ports: Phase2BootstrapPorts = {
    async upsertDefaultLocation() {
      const existing = await db
        .select({ id: locations.id, code: locations.code })
        .from(locations)
        .where(
          and(
            eq(locations.organizationId, DEMO_SEED_ORGANIZATION_ID),
            eq(locations.code, PHASE2_DEFAULT_LOCATION_CODE),
          ),
        )
        .limit(1);
      if (existing[0] !== undefined) {
        return existing[0];
      }
      const inserted = await db
        .insert(locations)
        .values({
          code: PHASE2_DEFAULT_LOCATION_CODE,
          organizationId: DEMO_SEED_ORGANIZATION_ID,
        })
        .returning({ id: locations.id, code: locations.code });
      return inserted[0]!;
    },
    async upsertPrerequisiteSupplier() {
      const existing = await db
        .select({ id: suppliers.id, vendorNumber: suppliers.vendorNumber })
        .from(suppliers)
        .where(
          and(
            eq(suppliers.organizationId, DEMO_SEED_ORGANIZATION_ID),
            eq(suppliers.vendorNumber, PHASE2_SUPPLIER_VENDOR_NUMBER),
          ),
        )
        .limit(1);
      if (existing[0] !== undefined) {
        return existing[0];
      }
      const inserted = await db
        .insert(suppliers)
        .values({
          organizationId: DEMO_SEED_ORGANIZATION_ID,
          vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER,
          name: PHASE2_SUPPLIER_NAME,
        })
        .returning({ id: suppliers.id, vendorNumber: suppliers.vendorNumber });
      return inserted[0]!;
    },
  };

  return runPhase2Bootstrap(ports);
}
