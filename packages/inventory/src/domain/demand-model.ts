import { computeAvailable, freezeStockFigures, type StockFigures } from "./snapshot.js";
import {
  computeSellWindowStatus,
  type SellWindowTiming,
} from "./sell-window.js";

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

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** New windows may not open on a UTC calendar day before `now`. */
export function isSellWindowOpenInThePast(
  windowOpensAt: Date | null,
  now: Date,
): boolean {
  if (windowOpensAt === null) {
    return false;
  }
  return utcDateKey(windowOpensAt) < utcDateKey(now);
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

/**
 * Observe the persisted window first, then apply new instants only when still
 * allowed to stay non-sticky. Prevents setSellWindow from reopening after close.
 */
export function applySetSellWindow(
  demand: DemandPersistedState,
  windowOpensAt: Date | null,
  windowClosesAt: Date | null,
  now: Date,
): DemandPersistedState {
  const observedPersisted = observeWindowClose(demand, now);
  if (observedPersisted.stickyLocked) {
    return observedPersisted;
  }
  const withNewWindow: DemandPersistedState = Object.freeze({
    ...demand,
    windowOpensAt,
    windowClosesAt,
  });
  return observeWindowClose(withNewWindow, now);
}

export type EffectiveSellStateOptions = Readonly<{
  /** Precomputed from SQL EXISTS — any active SellWindow membership at `now`. */
  hasActiveSellWindowMembership?: boolean;
  /** Full timings for in-memory OR across overlapping SellWindow memberships. */
  activeSellWindows?: readonly SellWindowTiming[];
}>;

/** Snapshot instants only — does not consult SellWindow memberships. */
export function isSnapshotSellWindowOpen(
  state: Pick<DemandPersistedState, "windowOpensAt" | "windowClosesAt">,
  now: Date,
): boolean {
  if (state.windowOpensAt !== null && now < state.windowOpensAt) {
    return false;
  }
  if (state.windowClosesAt !== null && now >= state.windowClosesAt) {
    return false;
  }
  return true;
}

export function hasActiveSellWindowMembership(
  windows: readonly SellWindowTiming[],
  now: Date,
): boolean {
  return windows.some((window) => computeSellWindowStatus(window, now) === "open");
}

function resolveActiveSellWindowMembership(
  now: Date,
  options?: EffectiveSellStateOptions,
): boolean {
  if (options?.hasActiveSellWindowMembership === true) {
    return true;
  }
  if (options?.activeSellWindows !== undefined && options.activeSellWindows.length > 0) {
    return hasActiveSellWindowMembership(options.activeSellWindows, now);
  }
  return false;
}

export function computeEffectiveSellState(
  state: DemandPersistedState,
  now: Date,
  options?: EffectiveSellStateOptions,
): SellState {
  if (state.stickyLocked) {
    return "locked";
  }
  if (isSnapshotSellWindowOpen(state, now)) {
    return "open";
  }
  if (resolveActiveSellWindowMembership(now, options)) {
    return "open";
  }
  return "locked";
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

/** Cell qty shape staff/shop catalog lists consume (anti-corruption target for Catalog ProductQty). */
export type StaffCatalogQtyCell = Readonly<{
  onHand: number;
  onOrder: number;
  allocated: number;
  available: number;
  committed: number;
  sellState: SellState;
  /** `null` means no numeric cap while effectively open. */
  availableToSell: number | null;
}>;

export const ZERO_STAFF_CATALOG_QTY_CELL: StaffCatalogQtyCell = Object.freeze({
  onHand: 0,
  onOrder: 0,
  allocated: 0,
  available: 0,
  committed: 0,
  sellState: "open",
  availableToSell: null,
});

/** Persisted inventory snapshot columns joined for staff/shop catalog qty cells. */
export type StaffCatalogQtySnapshotRow = Readonly<{
  onHand: number;
  onOrder: number;
  allocated: number;
  committed: number;
  stickyLocked: boolean;
  windowOpensAt: Date | null;
  windowClosesAt: Date | null;
}>;

export function staffCatalogQtyDemandState(
  row: Pick<
    StaffCatalogQtySnapshotRow,
    "committed" | "stickyLocked" | "windowOpensAt" | "windowClosesAt"
  >,
): DemandPersistedState {
  return Object.freeze({
    committed: row.committed,
    stickyLocked: row.stickyLocked,
    windowOpensAt: row.windowOpensAt,
    windowClosesAt: row.windowClosesAt,
  });
}

/** Projects one staff/shop catalog qty cell from persisted snapshot columns. */
export function projectStaffCatalogQtyFromSnapshot(
  row: StaffCatalogQtySnapshotRow,
  now: Date,
  options?: EffectiveSellStateOptions,
): StaffCatalogQtyCell {
  const projected = projectDemandFigures(
    freezeStockFigures(row.onHand, row.onOrder, row.allocated),
    staffCatalogQtyDemandState(row),
    now,
    options,
  );
  return Object.freeze({
    onHand: projected.onHand,
    onOrder: projected.onOrder,
    allocated: projected.allocated,
    available: projected.available,
    committed: projected.committed,
    sellState: projected.sellState,
    availableToSell: projected.availableToSell,
  });
}

export type StaffCatalogQtySortOrder = "asc" | "desc";

export function compareStaffCatalogQtyAvailableToSell(
  a: StaffCatalogQtyCell,
  b: StaffCatalogQtyCell,
  sortOrder: StaffCatalogQtySortOrder,
): number {
  const aValue = a.availableToSell;
  const bValue = b.availableToSell;
  if (aValue === null && bValue === null) {
    return 0;
  }
  if (aValue === null) {
    return sortOrder === "desc" ? -1 : 1;
  }
  if (bValue === null) {
    return sortOrder === "desc" ? 1 : -1;
  }
  return sortOrder === "desc" ? bValue - aValue : aValue - bValue;
}

export function compareStaffCatalogQtySellState(
  a: StaffCatalogQtyCell,
  b: StaffCatalogQtyCell,
): number {
  const rank = (sellState: SellState) => (sellState === "open" ? 0 : 1);
  return rank(a.sellState) - rank(b.sellState);
}

export function projectDemandFigures(
  figures: StockFigures,
  demand: DemandPersistedState,
  now: Date,
  options?: EffectiveSellStateOptions,
): DemandStockFigures {
  const sellState = computeEffectiveSellState(demand, now, options);
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

export function receiveCoverIdempotencyKey(baseKey: string, orderId: string): string {
  return `${baseKey}:cover:${orderId}`;
}
