import { InvalidIdError, LocationId, OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { DrizzleInventoryReadModel } from "../src/adapters/drizzle-inventory-read-model.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
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
  it("returns no movements when the filter location code is unknown", async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: async () => {
            throw new Error("listMovements should not query after an unknown location");
          },
        }),
      }),
    };

    const readModel = new DrizzleInventoryReadModel(db as never, async () => {
      throw new Error(`Unknown inventory location code ${FILTER_LOCATION}`);
    });

    const movements = await readModel.listMovements({
      organizationId: DEFAULT_ORG,
      locationId: FILTER_LOCATION,
    });
    expect(movements).toHaveLength(0);
  });

  it("resolves the location once and skips rows at other location uuids", async () => {
    const rows = [
      movementRow(DEFAULT_ORG, DEFAULT_LOCATION_UUID),
      movementRow(DEFAULT_ORG, "550e8400-e29b-41d4-a716-446655440099"),
    ];
    const db = {
      select: () => ({
        from: () => ({
          where: async () => rows,
        }),
      }),
    };

    let resolveCount = 0;
    const readModel = new DrizzleInventoryReadModel(db as never, async () => {
      resolveCount += 1;
      return DEFAULT_LOCATION_UUID;
    });

    const movements = await readModel.listMovements({
      organizationId: DEFAULT_ORG,
      locationId: FILTER_LOCATION,
    });
    expect(resolveCount).toBe(1);
    expect(movements).toHaveLength(1);
    expect(movements[0]?.organizationId).toBe(DEFAULT_ORG);
  });

  it("skips rows whose sku is not a valid Sku so one bad ledger row cannot fail the list", async () => {
    const rows = [
      movementRow(DEFAULT_ORG, DEFAULT_LOCATION_UUID),
      {
        ...movementRow(DEFAULT_ORG, DEFAULT_LOCATION_UUID),
        id: "550e8400-e29b-41d4-a716-446655440012",
        sku: "BABY ROSE / BUSH",
        idempotencyKey: "key-2",
      },
    ];
    const db = {
      select: () => ({
        from: () => ({
          where: async () => rows,
        }),
      }),
    };

    const readModel = new DrizzleInventoryReadModel(db as never, async () => DEFAULT_LOCATION_UUID);

    const movements = await readModel.listMovements({ organizationId: DEFAULT_ORG });
    expect(movements).toHaveLength(1);
    expect(movements[0]?.sku.value).toBe("WIDGET-1");
  });

  it("rethrows InvalidIdError so a bad movement id is not hidden from callers", async () => {
    const rows = [
      movementRow(DEFAULT_ORG, DEFAULT_LOCATION_UUID),
      {
        ...movementRow(DEFAULT_ORG, DEFAULT_LOCATION_UUID),
        id: "not-a-uuid",
        idempotencyKey: "key-2",
      },
    ];
    const db = {
      select: () => ({
        from: () => ({
          where: async () => rows,
        }),
      }),
    };

    const readModel = new DrizzleInventoryReadModel(db as never, async () => DEFAULT_LOCATION_UUID);

    await expect(
      readModel.listMovements({ organizationId: DEFAULT_ORG }),
    ).rejects.toThrow(InvalidIdError);
  });
});

describe("DrizzleInventoryReadModel findMovementByIdempotency", () => {
  it("returns the movement keyed by organization, idempotency key, and sku", async () => {
    const row = {
      ...movementRow(DEFAULT_ORG, DEFAULT_LOCATION_UUID),
      movementType: "Committed" as const,
      qty: 25,
      refType: "sales_order" as const,
      refId: "550e8400-e29b-41d4-a716-446655440020",
      idempotencyKey: "confirm-line-1",
    };
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [row],
          }),
        }),
      }),
    };

    const readModel = new DrizzleInventoryReadModel(db as never, async () => DEFAULT_LOCATION_UUID);
    const movement = await readModel.findMovementByIdempotency(
      DEFAULT_ORG,
      "confirm-line-1",
      Sku.parse("WIDGET-1"),
    );

    expect(movement).toMatchObject({
      movementType: "Committed",
      quantity: 25,
      refType: "sales_order",
      refId: "550e8400-e29b-41d4-a716-446655440020",
      idempotencyKey: "confirm-line-1",
    });
  });

  it("returns undefined when no movement matches the idempotency key", async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    };

    const readModel = new DrizzleInventoryReadModel(db as never, async () => DEFAULT_LOCATION_UUID);
    const movement = await readModel.findMovementByIdempotency(
      DEFAULT_ORG,
      "missing-key",
      Sku.parse("WIDGET-1"),
    );
    expect(movement).toBeUndefined();
  });
});
