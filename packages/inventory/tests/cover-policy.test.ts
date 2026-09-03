import { LocationId, OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import {
  allocateReceiveCover,
  gateCommittedQuantity,
  planConfirmCoverAllocation,
  planReceiveCoverAllocation,
  recordCommittedWithCover,
  type CoverPolicyReadState,
  type CoverPolicyRecorder,
} from "../src/domain/cover-policy.js";
import { ZERO_DEMAND_STATE } from "../src/domain/demand-model.js";
import type { RecordCommittedCommand, StockCommandResult } from "../src/domain/ports/stock-ledger.js";
import { freezeStockFigures } from "../src/domain/snapshot.js";

const ORG = OrganizationId.DEFAULT;
const SKU = Sku.parse("ADA-255-COVER");
const LOCATION = LocationId.DEFAULT;

function lockedState(
  figures = freezeStockFigures(500, 0, 0),
  committed = 0,
): CoverPolicyReadState {
  return {
    figures,
    demand: {
      ...ZERO_DEMAND_STATE,
      committed,
      stickyLocked: true,
    },
    now: new Date("2026-06-15T12:00:00.000Z"),
  };
}

function openState(
  figures = freezeStockFigures(500, 0, 0),
  committed = 0,
): CoverPolicyReadState {
  return {
    figures,
    demand: {
      ...ZERO_DEMAND_STATE,
      committed,
      stickyLocked: false,
    },
    now: new Date("2026-06-15T12:00:00.000Z"),
  };
}

function committedCommand(quantity: number): RecordCommittedCommand {
  return {
    organizationId: ORG,
    idempotencyKey: "commit-key",
    sku: SKU,
    quantity,
    locationId: LOCATION,
    refType: "sales_order",
    refId: "SO-255",
  };
}

function recordingStub(
  onRecord?: (movementType: "Committed" | "Allocated", quantity: number) => void,
): {
  calls: Array<{ movementType: "Committed" | "Allocated"; quantity: number }>;
  record: CoverPolicyRecorder;
} {
  const calls: Array<{ movementType: "Committed" | "Allocated"; quantity: number }> = [];
  const record: CoverPolicyRecorder = async (movementType, command) => {
    calls.push({ movementType, quantity: command.quantity });
    onRecord?.(movementType, command.quantity);
    return {
      ok: true,
      movement: {
        id: "mov-1" as never,
        organizationId: ORG,
        sku: SKU,
        locationId: LOCATION,
        movementType,
        quantity: command.quantity,
        refType: command.refType,
        refId: command.refId,
        idempotencyKey: command.idempotencyKey,
        createdAt: new Date(),
      },
    };
  };
  return { calls, record };
}

describe("cover-policy (ADA-255)", () => {
  it("rejects locked commits above available-to-sell", () => {
    const failure = gateCommittedQuantity(1_200, lockedState(freezeStockFigures(500, 0, 0), 0));
    expect(failure).toEqual({ ok: false, reason: "insufficient_available_to_sell" });
  });

  it("allows locked commits within available-to-sell", () => {
    expect(gateCommittedQuantity(500, lockedState(freezeStockFigures(500, 0, 0), 0))).toBeNull();
  });

  it("does not gate commits while sell state is open", () => {
    expect(gateCommittedQuantity(10_000, openState())).toBeNull();
  });

  it("plans confirm cover up to leftover available", () => {
    const allocation = planConfirmCoverAllocation(
      committedCommand(100),
      100,
      freezeStockFigures(30, 0, 0),
    );
    expect(allocation).toMatchObject({
      quantity: 30,
      idempotencyKey: "commit-key:cover",
      refType: "sales_order",
      refId: "SO-255",
    });
  });

  it("plans receive cover for committed demand not yet allocated", () => {
    const allocation = planReceiveCoverAllocation(
      {
        organizationId: ORG,
        idempotencyKey: "receive-key",
        sku: SKU,
        locationId: LOCATION,
        refId: "PO-255",
      },
      1_900,
      freezeStockFigures(500, 0, 30),
      1_200,
    );
    expect(allocation).toMatchObject({
      quantity: 1_170,
      idempotencyKey: "receive-key:cover",
      refType: "sales_order",
      refId: "PO-255",
    });
  });

  it("records Committed then leftover Allocated through one policy sequence", async () => {
    const { calls, record } = recordingStub();
    let state = openState(freezeStockFigures(30, 0, 0));

    const result = await recordCommittedWithCover(committedCommand(100), {
      readState: () => state,
      record: async (movementType, command) => {
        const recorded = await record(movementType, command);
        if (movementType === "Committed") {
          state = {
            ...state,
            figures: freezeStockFigures(30, 0, 0),
            demand: { ...state.demand, committed: 100 },
          };
        }
        if (movementType === "Allocated") {
          state = {
            ...state,
            figures: freezeStockFigures(30, 30, 0),
          };
        }
        return recorded;
      },
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      { movementType: "Committed", quantity: 100 },
      { movementType: "Allocated", quantity: 30 },
    ]);
  });

  it("allocates receive cover after GoodsReceived without a second receive write", async () => {
    const { calls, record } = recordingStub();
    const state: CoverPolicyReadState = {
      figures: freezeStockFigures(500, 0, 30),
      demand: { ...ZERO_DEMAND_STATE, committed: 1_200 },
      now: new Date("2026-06-15T12:00:00.000Z"),
    };

    const coverResult = await allocateReceiveCover(
      {
        organizationId: ORG,
        idempotencyKey: "receive-key",
        sku: SKU,
        quantity: 1_900,
        locationId: LOCATION,
        refType: "purchase_order",
        refId: "PO-255",
      },
      1_900,
      {
        readState: () => state,
        record,
      },
    );

    expect(coverResult?.ok).toBe(true);
    expect(calls).toEqual([{ movementType: "Allocated", quantity: 1_170 }]);
  });

  it("surfaces recorder failures from confirm cover allocation", async () => {
    const failingRecord: CoverPolicyRecorder = async (movementType) => {
      if (movementType === "Allocated") {
        return { ok: false, reason: "insufficient_available" };
      }
      return {
        ok: true,
        movement: {
          id: "mov-1" as never,
          organizationId: ORG,
          sku: SKU,
          locationId: LOCATION,
          movementType: "Committed",
          quantity: 100,
          refType: "sales_order",
          refId: "SO-255",
          idempotencyKey: "commit-key",
          createdAt: new Date(),
        },
      };
    };

    let state = openState(freezeStockFigures(30, 0, 0));
    const result: StockCommandResult = await recordCommittedWithCover(committedCommand(100), {
      readState: () => state,
      record: async (movementType, command) => {
        const recorded = await failingRecord(movementType, command);
        if (movementType === "Committed") {
          state = {
            ...state,
            demand: { ...state.demand, committed: 100 },
          };
        }
        return recorded;
      },
    });

    expect(result).toEqual({ ok: false, reason: "insufficient_available" });
  });
});
