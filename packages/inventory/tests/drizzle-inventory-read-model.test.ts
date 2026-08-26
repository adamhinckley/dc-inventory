import { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { DrizzleInventoryReadModel } from "../src/adapters/drizzle-inventory-read-model.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");
const DEFAULT_LOCATION_UUID = "550e8400-e29b-41d4-a716-446655440001";
const FILTER_LOCATION = LocationId.DEFAULT;

function movementRow(organizationId: OrganizationId, locationId: string) {
  return {
    id: "550e8400-e29b-41d4-a716-446655440010",
    organizationId,
    sku: "WIDGET-1",
    locationId,
    movementType: "AdjustmentIncrease" as const,
    qty: 1,
    refType: "adjustment" as const,
    refId: "550e8400-e29b-41d4-a716-446655440011",
    idempotencyKey: "key-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

describe("DrizzleInventoryReadModel listMovements", () => {
  it("skips rows when resolveLocationUuid throws unknown location code", async () => {
    const rows = [
      movementRow(DEFAULT_ORG, DEFAULT_LOCATION_UUID),
      movementRow(BETA_ORG, "550e8400-e29b-41d4-a716-446655440099"),
    ];
    const db = {
      select: () => ({
        from: () => ({
          where: async () => rows,
        }),
      }),
    };

    const readModel = new DrizzleInventoryReadModel(db as never, async (organizationId) => {
      if (organizationId === BETA_ORG) {
        throw new Error(`Unknown inventory location code ${FILTER_LOCATION}`);
      }
      return DEFAULT_LOCATION_UUID;
    });

    const movements = await readModel.listMovements({ locationId: FILTER_LOCATION });
    expect(movements).toHaveLength(1);
    expect(movements[0]?.organizationId).toBe(DEFAULT_ORG);
  });
});
