import type { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";
import type { MovementType } from "./movement.js";
import {
  computeConfirmCoverQuantity,
  computeEffectiveSellState,
  computeLockedAvailableToSell,
  computeReceiveCoverQuantity,
  coverIdempotencyKey,
  receiveCoverIdempotencyKey,
  type DemandPersistedState,
} from "./demand-model.js";
import { isPositiveIntegerQuantity } from "./ledger-rules.js";
import {
  listFifoUncoveredCommittedOrders,
  type OrderCoverMovement,
} from "./order-cover.js";
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

export const RECEIVE_COVER_MOVEMENT_TYPES = [
  "Committed",
  "Decommitted",
  "Allocated",
  "Deallocated",
] as const satisfies readonly MovementType[];

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
    return { ok: false, reason: "insufficient_available_to_sell", availableToSell };
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
  return buildConfirmCoverAllocation(command, coverQty);
}

export function planReceiveCoverAllocations(
  command: Pick<
    RecordGoodsReceivedCommand,
    "idempotencyKey" | "organizationId" | "sku" | "locationId"
  >,
  receivedQuantity: number,
  figuresAfterReceive: StockFigures,
  committed: number,
  movements: readonly OrderCoverMovement[],
): readonly CoverAllocatedCommand[] {
  const totalCoverQty = computeReceiveCoverQuantity(
    receivedQuantity,
    figuresAfterReceive,
    committed,
  );
  if (totalCoverQty <= 0) {
    return [];
  }

  let remaining = totalCoverQty;
  const allocations: CoverAllocatedCommand[] = [];
  for (const uncoveredOrder of listFifoUncoveredCommittedOrders(movements)) {
    if (remaining <= 0) {
      break;
    }
    const coverQty = Math.min(uncoveredOrder.uncoveredQty, remaining);
    if (coverQty <= 0) {
      continue;
    }
    allocations.push(
      buildReceiveCoverAllocation(command, uncoveredOrder.orderId, coverQty),
    );
    remaining -= coverQty;
  }

  return Object.freeze(allocations);
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
 * Receive cover sequence: after GoodsReceived, FIFO-allocate uncovered committed demand.
 * Caller records GoodsReceived (with demand observation) before invoking.
 */
export async function allocateReceiveCover(
  command: RecordGoodsReceivedCommand,
  receivedQuantity: number,
  deps: {
    readState: () => CoverPolicyReadState | Promise<CoverPolicyReadState>;
    listMovements: () => readonly OrderCoverMovement[] | Promise<readonly OrderCoverMovement[]>;
    record: CoverPolicyRecorder;
  },
): Promise<StockCommandResult | null> {
  const state = await deps.readState();
  const totalCoverQty = computeReceiveCoverQuantity(
    receivedQuantity,
    state.figures,
    state.demand.committed,
  );
  if (totalCoverQty <= 0) {
    return null;
  }
  const movements = await deps.listMovements();
  const allocations = planReceiveCoverAllocations(
    command,
    receivedQuantity,
    state.figures,
    state.demand.committed,
    movements,
  );
  if (allocations.length === 0) {
    return null;
  }

  let lastSuccess: Extract<StockCommandResult, { ok: true }> | undefined;
  for (const allocation of allocations) {
    const coverResult = await deps.record("Allocated", allocation);
    if (!coverResult.ok) {
      return coverResult;
    }
    lastSuccess = coverResult;
  }
  return lastSuccess ?? null;
}

function buildConfirmCoverAllocation(
  command: Pick<
    RecordCommittedCommand,
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

function buildReceiveCoverAllocation(
  command: Pick<
    RecordGoodsReceivedCommand,
    "idempotencyKey" | "organizationId" | "sku" | "locationId"
  >,
  orderId: string,
  coverQty: number,
): CoverAllocatedCommand {
  return Object.freeze({
    organizationId: command.organizationId,
    idempotencyKey: receiveCoverIdempotencyKey(command.idempotencyKey, orderId),
    sku: command.sku,
    quantity: coverQty,
    locationId: command.locationId,
    refType: "sales_order",
    refId: orderId,
  });
}
