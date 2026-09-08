import { describe, expect, it } from "vitest";
import {
  computeEffectiveSellState,
  hasActiveSellWindowMembership,
  isSnapshotSellWindowOpen,
  projectStaffCatalogQtyFromSnapshot,
  type DemandPersistedState,
} from "../src/domain/demand-model.js";
import type { SellWindowTiming } from "../src/domain/sell-window.js";

const NOW = new Date("2026-09-03T12:00:00.000Z");
const OPENS = new Date("2026-09-03T10:00:00.000Z");
const CLOSES = new Date("2026-09-03T14:00:00.000Z");
const FUTURE_OPENS = new Date("2026-09-03T13:00:00.000Z");
const PAST_CLOSES = new Date("2026-09-03T11:00:00.000Z");

const LOCKED_SNAPSHOT: DemandPersistedState = Object.freeze({
  committed: 0,
  stickyLocked: false,
  windowOpensAt: FUTURE_OPENS,
  windowClosesAt: null,
});

const OPEN_SNAPSHOT: DemandPersistedState = Object.freeze({
  committed: 0,
  stickyLocked: false,
  windowOpensAt: null,
  windowClosesAt: null,
});

function windowTiming(
  windowOpensAt: Date | null,
  windowClosesAt: Date,
  manuallyClosedAt: Date | null = null,
): SellWindowTiming {
  return { windowOpensAt, windowClosesAt, manuallyClosedAt };
}

describe("computeEffectiveSellState OR across SellWindow memberships", () => {
  it("keeps snapshot-open SKUs open without memberships", () => {
    expect(computeEffectiveSellState(OPEN_SNAPSHOT, NOW)).toBe("open");
    expect(isSnapshotSellWindowOpen(OPEN_SNAPSHOT, NOW)).toBe(true);
  });

  it("opens when snapshot is locked but one overlapping SellWindow membership is active", () => {
    const active = windowTiming(OPENS, CLOSES);
    const closed = windowTiming(OPENS, PAST_CLOSES);
    expect(
      computeEffectiveSellState(LOCKED_SNAPSHOT, NOW, {
        activeSellWindows: [closed, active],
      }),
    ).toBe("open");
    expect(hasActiveSellWindowMembership([closed, active], NOW)).toBe(true);
  });

  it("stays locked when every SellWindow membership is closed", () => {
    const manuallyClosed = windowTiming(OPENS, CLOSES, NOW);
    const elapsed = windowTiming(OPENS, PAST_CLOSES);
    expect(
      computeEffectiveSellState(LOCKED_SNAPSHOT, NOW, {
        activeSellWindows: [manuallyClosed, elapsed],
      }),
    ).toBe("locked");
    expect(hasActiveSellWindowMembership([manuallyClosed, elapsed], NOW)).toBe(false);
  });

  it("stays locked for a scheduled future SellWindow until opens", () => {
    const scheduled = windowTiming(FUTURE_OPENS, CLOSES);
    expect(
      computeEffectiveSellState(LOCKED_SNAPSHOT, NOW, {
        activeSellWindows: [scheduled],
      }),
    ).toBe("locked");
    expect(
      computeEffectiveSellState(LOCKED_SNAPSHOT, FUTURE_OPENS, {
        activeSellWindows: [scheduled],
      }),
    ).toBe("open");
  });

  it("sticky lock overrides active SellWindow memberships", () => {
    const active = windowTiming(OPENS, CLOSES);
    const sticky: DemandPersistedState = Object.freeze({
      ...LOCKED_SNAPSHOT,
      stickyLocked: true,
    });
    expect(
      computeEffectiveSellState(sticky, NOW, {
        activeSellWindows: [active],
      }),
    ).toBe("locked");
  });

  it("projects staff catalog qty cells with hasActiveSellWindowMembership", () => {
    const row = {
      onHand: 5,
      onOrder: 0,
      allocated: 0,
      committed: 0,
      stickyLocked: false,
      windowOpensAt: FUTURE_OPENS,
      windowClosesAt: null,
    };
    const locked = projectStaffCatalogQtyFromSnapshot(row, NOW);
    const opened = projectStaffCatalogQtyFromSnapshot(row, NOW, {
      hasActiveSellWindowMembership: true,
    });
    expect(locked.sellState).toBe("locked");
    expect(locked.availableToSell).toBe(5);
    expect(opened.sellState).toBe("open");
    expect(opened.availableToSell).toBeNull();
  });
});
