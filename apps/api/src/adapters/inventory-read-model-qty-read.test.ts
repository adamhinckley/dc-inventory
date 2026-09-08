import { ZERO_QTY } from "@dc-inventory/catalog";
import {
  InMemoryClock,
  InMemoryInventoryReadModel,
  InMemorySellWindowRepository,
  SellWindowId,
  ZERO_DEMAND_STATE,
  ZERO_STOCK_FIGURES,
} from "@dc-inventory/inventory";
import { LocationId, OrganizationId, Sku, StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InventoryReadModelQtyReadAdapter } from "./inventory-read-model-qty-read.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const OPEN_COMMITTED_SKU = Sku.parse("OPEN-COMMITTED-ONLY");
const STICKY_LOCKED_SKU = Sku.parse("STICKY-LOCKED-EMPTY");
const MEMBERSHIP_SKU = Sku.parse("MEMBERSHIP-SKU");
const STAFF = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const NOW = new Date("2026-09-03T12:00:00.000Z");
const FUTURE_OPENS = new Date("2026-09-03T13:00:00.000Z");
const WINDOW_CLOSES = new Date("2026-09-03T14:00:00.000Z");

describe("InventoryReadModelQtyReadAdapter", () => {
  it("passes through committed-only open snapshots with empty warehouse stock", async () => {
    const readModel = new InMemoryInventoryReadModel(
      new InMemoryClock(new Date("2026-06-15T12:00:00.000Z")),
    );
    readModel.seedSnapshot(
      OPEN_COMMITTED_SKU,
      LocationId.DEFAULT,
      ZERO_STOCK_FIGURES,
      DEFAULT_ORG,
      {
        committed: 500,
        stickyLocked: false,
        windowOpensAt: null,
        windowClosesAt: null,
      },
    );

    const adapter = new InventoryReadModelQtyReadAdapter(readModel);
    const snapshots = await adapter.readBySkus(DEFAULT_ORG, [OPEN_COMMITTED_SKU]);

    expect(snapshots.get(OPEN_COMMITTED_SKU.value)).toEqual({
      onHand: 0,
      onOrder: 0,
      allocated: 0,
      available: 0,
      committed: 500,
      sellState: "open",
      availableToSell: null,
      stickyLocked: false,
      windowOpensAt: null,
      windowClosesAt: null,
      hasActiveSellWindowMembership: false,
    });
  });

  it("passes through sticky-locked empty warehouse snapshots", async () => {
    const readModel = new InMemoryInventoryReadModel(
      new InMemoryClock(new Date("2026-06-15T12:00:00.000Z")),
    );
    readModel.seedSnapshot(
      STICKY_LOCKED_SKU,
      LocationId.DEFAULT,
      ZERO_STOCK_FIGURES,
      DEFAULT_ORG,
      {
        committed: 0,
        stickyLocked: true,
        windowOpensAt: null,
        windowClosesAt: null,
      },
    );

    const adapter = new InventoryReadModelQtyReadAdapter(readModel);
    const snapshots = await adapter.readBySkus(DEFAULT_ORG, [STICKY_LOCKED_SKU]);

    expect(snapshots.get(STICKY_LOCKED_SKU.value)).toEqual({
      onHand: 0,
      onOrder: 0,
      allocated: 0,
      available: 0,
      committed: 0,
      sellState: "locked",
      availableToSell: 0,
      stickyLocked: true,
      windowOpensAt: null,
      windowClosesAt: null,
      hasActiveSellWindowMembership: false,
    });
  });

  it("projects bare empty snapshots as ZERO_QTY instead of omitting them", async () => {
    const readModel = new InMemoryInventoryReadModel();
    const adapter = new InventoryReadModelQtyReadAdapter(readModel);
    const snapshots = await adapter.readBySkus(DEFAULT_ORG, [OPEN_COMMITTED_SKU]);

    expect(snapshots.get(OPEN_COMMITTED_SKU.value)).toMatchObject({
      ...ZERO_QTY,
      hasActiveSellWindowMembership: false,
      stickyLocked: false,
      windowOpensAt: null,
      windowClosesAt: null,
    });
  });

  it("ORs active SellWindow membership into qty snapshots with sell-window fields", async () => {
    const readModel = new InMemoryInventoryReadModel(new InMemoryClock(NOW));
    readModel.seedSnapshot(
      MEMBERSHIP_SKU,
      LocationId.DEFAULT,
      { ...ZERO_STOCK_FIGURES, onHand: 4, available: 4 },
      DEFAULT_ORG,
      {
        committed: 0,
        stickyLocked: false,
        windowOpensAt: FUTURE_OPENS,
        windowClosesAt: null,
      },
    );
    const sellWindows = new InMemorySellWindowRepository();
    await sellWindows.create({
      window: {
        id: SellWindowId.parse("da209000-0000-4000-8000-000000000701"),
        organizationId: DEFAULT_ORG,
        name: "Summer",
        filterSnapshot: {},
        windowOpensAt: new Date("2026-09-03T10:00:00.000Z"),
        windowClosesAt: WINDOW_CLOSES,
        status: "open",
        manuallyClosedAt: null,
        appliedBy: STAFF,
        appliedAt: NOW,
        skuCount: 1,
        createdAt: NOW,
        updatedAt: NOW,
      },
      skus: [MEMBERSHIP_SKU],
    });

    const adapter = new InventoryReadModelQtyReadAdapter(
      readModel,
      sellWindows,
      new InMemoryClock(NOW),
    );
    const snapshots = await adapter.readBySkus(DEFAULT_ORG, [MEMBERSHIP_SKU]);
    expect(snapshots.get(MEMBERSHIP_SKU.value)).toMatchObject({
      sellState: "open",
      hasActiveSellWindowMembership: true,
      windowOpensAt: FUTURE_OPENS,
    });
  });
});
