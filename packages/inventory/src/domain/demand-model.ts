import { computeAvailable, type StockFigures } from "./snapshot.js";

export type SellState = "open" | "locked";

/** Persisted demand fields on the inventory snapshot row. */
export type DemandPersistedState = Readonly<{
  committed: number;
  stickyLocked: boolean;
  windowOpensAt: Date | null;
  windowClosesAt: Date | null;
}>;

export const ZERO_DEMAND_STATE: DemandPersistedState = Object.freeze({
  committed: 0,
  stickyLocked: false,
  windowOpensAt: null,
  windowClosesAt: null,
});

export type DemandStockFigures = StockFigures &
  Readonly<{
    committed: number;
    sellState: SellState;
    /** `null` means no numeric cap while effectively open. */
    availableToSell: number | null;
    uncovered: number;
    windowOpensAt: Date | null;
    windowClosesAt: Date | null;
    stickyLocked: boolean;
  }>;

export function computeUncovered(committed: number, onHand: number, onOrder: number): number {
  return Math.max(0, committed - onHand - onOrder);
}

export function computeLockedAvailableToSell(
  onHand: number,
  onOrder: number,
  committed: number,
): number {
  return onHand + onOrder - committed;
}

export function isSellWindowInvalid(
  windowOpensAt: Date | null,
  windowClosesAt: Date | null,
): boolean {
  if (windowOpensAt !== null && windowClosesAt !== null) {
    return windowOpensAt >= windowClosesAt;
  }
  return false;
}

/** Persist sticky lock when a write observes the sell window has closed. */
export function observeWindowClose(
  state: DemandPersistedState,
  now: Date,
): DemandPersistedState {
  if (state.stickyLocked) {
    return state;
  }
  if (state.windowClosesAt !== null && now >= state.windowClosesAt) {
    return Object.freeze({ ...state, stickyLocked: true });
  }
  return state;
}

export function computeEffectiveSellState(
  state: DemandPersistedState,
  now: Date,
): SellState {
  if (state.stickyLocked) {
    return "locked";
  }
  if (state.windowOpensAt !== null && now < state.windowOpensAt) {
    return "locked";
  }
  if (state.windowClosesAt !== null && now >= state.windowClosesAt) {
    return "locked";
  }
  return "open";
}

export function computeAvailableToSell(
  sellState: SellState,
  onHand: number,
  onOrder: number,
  committed: number,
): number | null {
  if (sellState === "open") {
    return null;
  }
  return computeLockedAvailableToSell(onHand, onOrder, committed);
}

export function projectDemandFigures(
  figures: StockFigures,
  demand: DemandPersistedState,
  now: Date,
): DemandStockFigures {
  const sellState = computeEffectiveSellState(demand, now);
  const availableToSell = computeAvailableToSell(
    sellState,
    figures.onHand,
    figures.onOrder,
    demand.committed,
  );
  const uncovered = computeUncovered(demand.committed, figures.onHand, figures.onOrder);

  return Object.freeze({
    ...figures,
    committed: demand.committed,
    sellState,
    availableToSell,
    uncovered,
    windowOpensAt: demand.windowOpensAt,
    windowClosesAt: demand.windowClosesAt,
    stickyLocked: demand.stickyLocked,
  });
}

/** Warehouse cover at confirm: min(commit qty, leftover available). */
export function computeConfirmCoverQuantity(commitQuantity: number, figures: StockFigures): number {
  return Math.min(commitQuantity, figures.available);
}

/** FIFO cover on receive: min(received qty, committed not yet allocated). */
export function computeReceiveCoverQuantity(
  receivedQuantity: number,
  figures: StockFigures,
  committed: number,
): number {
  const uncoveredAllocation = Math.max(0, committed - figures.allocated);
  return Math.min(receivedQuantity, uncoveredAllocation);
}

export function coverIdempotencyKey(baseKey: string): string {
  return `${baseKey}:cover`;
}
