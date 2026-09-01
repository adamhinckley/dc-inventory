import { ZERO_QTY } from "@dc-inventory/catalog";
import {
  InMemoryClock,
  InMemoryInventoryReadModel,
  ZERO_DEMAND_STATE,
  ZERO_STOCK_FIGURES,
} from "@dc-inventory/inventory";
import { LocationId, OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InventoryReadModelQtyReadAdapter } from "./inventory-read-model-qty-read.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const OPEN_COMMITTED_SKU = Sku.parse("OPEN-COMMITTED-ONLY");
const STICKY_LOCKED_SKU = Sku.parse("STICKY-LOCKED-EMPTY");

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
    });
  });

  it("projects bare empty snapshots as ZERO_QTY instead of omitting them", async () => {
    const readModel = new InMemoryInventoryReadModel();
    const adapter = new InventoryReadModelQtyReadAdapter(readModel);
    const snapshots = await adapter.readBySkus(DEFAULT_ORG, [OPEN_COMMITTED_SKU]);

    expect(snapshots.get(OPEN_COMMITTED_SKU.value)).toEqual(ZERO_QTY);
  });
});
