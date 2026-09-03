import type { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";
import {
  computeConfirmCoverQuantity,
  computeEffectiveSellState,
  computeLockedAvailableToSell,
  computeReceiveCoverQuantity,
  coverIdempotencyKey,
  type DemandPersistedState,
} from "./demand-model.js";
import { isPositiveIntegerQuantity } from "./ledger-rules.js";
import type {
  RecordCommittedCommand,
  RecordGoodsReceivedCommand,
  StockCommandResult,
} from "./ports/stock-ledger.js";
import type { StockFigures } from "./snapshot.js";

export type CoverPolicyReadState = Readonly<{
  figures: StockFigures;
  demand: DemandPersistedState;
  now: Date;
}>;

export type CoverAllocatedCommand = Readonly<{
  organizationId: OrganizationId;
  idempotencyKey: string;
  sku: Sku;
  quantity: number;
  locationId?: LocationId;
  refType: "sales_order";
  refId: string;
}>;

export type CoverPolicyRecorder = (
  movementType: "Committed" | "Allocated",
  command: RecordCommittedCommand | CoverAllocatedCommand,
) => Promise<StockCommandResult>;

/** Gate commit qty against locked available-to-sell; null means proceed. */
export function gateCommittedQuantity(
  commitQuantity: number,
  state: CoverPolicyReadState,
): Extract<StockCommandResult, { ok: false }> | null {
  const sellState = computeEffectiveSellState(state.demand, state.now);
  if (sellState !== "locked") {
    return null;
  }
  const availableToSell = computeLockedAvailableToSell(
    state.figures.onHand,
    state.figures.onOrder,
    state.demand.committed,
  );
  if (commitQuantity > availableToSell) {
    return { ok: false, reason: "insufficient_available_to_sell" };
  }
  return null;
}

export function planConfirmCoverAllocation(
  command: Pick<RecordCommittedCommand, "idempotencyKey" | "organizationId" | "sku" | "locationId" | "refId">,
  commitQuantity: number,
  figuresAfterCommit: StockFigures,
): CoverAllocatedCommand | null {
  const coverQty = computeConfirmCoverQuantity(commitQuantity, figuresAfterCommit);
  if (coverQty <= 0) {
    return null;
  }
  return buildCoverAllocation(command, coverQty);
}

export function planReceiveCoverAllocation(
  command: Pick<
    RecordGoodsReceivedCommand,
    "idempotencyKey" | "organizationId" | "sku" | "locationId" | "refId"
  >,
  receivedQuantity: number,
  figuresAfterReceive: StockFigures,
  committed: number,
): CoverAllocatedCommand | null {
  const coverQty = computeReceiveCoverQuantity(
    receivedQuantity,
    figuresAfterReceive,
    committed,
  );
  if (coverQty <= 0) {
    return null;
  }
  return buildCoverAllocation(command, coverQty);
}

/**
 * Confirm cover sequence: gate locked available to sell → Committed → leftover Allocated.
 * Caller must observe sell-window close and lock snapshot rows before invoking.
 */
export async function recordCommittedWithCover(
  command: RecordCommittedCommand,
  deps: {
    readState: () => CoverPolicyReadState | Promise<CoverPolicyReadState>;
    record: CoverPolicyRecorder;
  },
): Promise<StockCommandResult> {
  if (!isPositiveIntegerQuantity(command.quantity)) {
    return { ok: false, reason: "invalid_quantity" };
  }

  const preCommitState = await deps.readState();
  const gateFailure = gateCommittedQuantity(command.quantity, preCommitState);
  if (gateFailure) {
    return gateFailure;
  }

  const committedResult = await deps.record("Committed", command);
  if (!committedResult.ok) {
    return committedResult;
  }

  const postCommitState = await deps.readState();
  const allocation = planConfirmCoverAllocation(
    command,
    command.quantity,
    postCommitState.figures,
  );
  if (allocation === null) {
    return committedResult;
  }

  const coverResult = await deps.record("Allocated", allocation);
  if (!coverResult.ok) {
    return coverResult;
  }
  return committedResult;
}

/**
 * Receive cover sequence: after GoodsReceived, allocate remaining committed demand.
 * Caller records GoodsReceived (with demand observation) before invoking.
 */
export async function allocateReceiveCover(
  command: RecordGoodsReceivedCommand,
  receivedQuantity: number,
  deps: {
    readState: () => CoverPolicyReadState | Promise<CoverPolicyReadState>;
    record: CoverPolicyRecorder;
  },
): Promise<StockCommandResult | null> {
  const state = await deps.readState();
  const allocation = planReceiveCoverAllocation(
    command,
    receivedQuantity,
    state.figures,
    state.demand.committed,
  );
  if (allocation === null) {
    return null;
  }
  return deps.record("Allocated", allocation);
}

function buildCoverAllocation(
  command: Pick<
    RecordCommittedCommand | RecordGoodsReceivedCommand,
    "idempotencyKey" | "organizationId" | "sku" | "locationId" | "refId"
  >,
  coverQty: number,
): CoverAllocatedCommand {
  return Object.freeze({
    organizationId: command.organizationId,
    idempotencyKey: coverIdempotencyKey(command.idempotencyKey),
    sku: command.sku,
    quantity: coverQty,
    locationId: command.locationId,
    refType: "sales_order",
    refId: command.refId,
  });
}
