import { LocationId, OrganizationId, PurchaseOrderId, Sku } from "@dc-inventory/shared-kernel";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GetStockSnapshotUseCase,
  InMemoryInventoryUnitOfWork,
  MOVEMENT_TYPES,
  ONCE_ONLY_PROVENANCE_TYPES,
  RecordAdjustmentDecreaseUseCase,
  RecordAdjustmentIncreaseUseCase,
  RecordAllocatedUseCase,
  RecordDeallocatedUseCase,
  RecordGoodsReceivedUseCase,
  RecordInboundCancelledUseCase,
  RecordInboundFromPoUseCase,
  RecordShippedUseCase,
  type MovementType,
  type StockFigures,
} from "../src/index.js";

const SKU = Sku.parse("HEX-BOLT-GALV");
const OTHER_SKU = Sku.parse("WASHER-SS");
const PO_ID = PurchaseOrderId.parse("550e8400-e29b-41d4-a716-446655440030");
const PO_ID_2 = PurchaseOrderId.parse("550e8400-e29b-41d4-a716-446655440031");
const SO_ID = "550e8400-e29b-41d4-a716-446655440040";
const SO_ID_2 = "550e8400-e29b-41d4-a716-446655440041";
const DEFAULT = LocationId.DEFAULT;
const DEFAULT_ORG = OrganizationId.DEFAULT;
const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");
const WIDGET_SKU = Sku.parse("WIDGET-1");

function harness() {
  const uow = new InMemoryInventoryUnitOfWork();
  const ledger = uow.ledger;
  return {
    uow,
    readModel: uow.readModel,
    getSnapshot: new GetStockSnapshotUseCase(uow.readModel),
    inboundFromPo: new RecordInboundFromPoUseCase(ledger),
    goodsReceived: new RecordGoodsReceivedUseCase(ledger),
    inboundCancelled: new RecordInboundCancelledUseCase(ledger),
    allocated: new RecordAllocatedUseCase(ledger),
    deallocated: new RecordDeallocatedUseCase(ledger),
    shipped: new RecordShippedUseCase(ledger),
    adjustmentIncrease: new RecordAdjustmentIncreaseUseCase(ledger),
    adjustmentDecrease: new RecordAdjustmentDecreaseUseCase(ledger),
  };
}

async function snapshot(h: ReturnType<typeof harness>): Promise<StockFigures> {
  return h.getSnapshot.execute({
 organizationId: DEFAULT_ORG,
sku: SKU, locationId: DEFAULT });
}

async function movements(h: ReturnType<typeof harness>) {
  return h.readModel.listMovements({ organizationId: DEFAULT_ORG, sku: SKU, locationId: DEFAULT });
}

describe("Inventory ledger (in-memory)", () => {
  describe("snapshot effects at (sku, LocationId.DEFAULT)", () => {
    it.each<[MovementType, StockFigures, () => Promise<unknown>]>([
      [
        "InboundFromPo",
        { onHand: 0, onOrder: 5, allocated: 0, available: 0 },
        async () => {
          const h = harness();
          await h.inboundFromPo.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "inbound-1",
            sku: SKU,
            quantity: 5,
            refType: "purchase_order",
            refId: PO_ID,
          });
          return h;
        },
      ],
      [
        "GoodsReceived",
        { onHand: 5, onOrder: 0, allocated: 0, available: 5 },
        async () => {
          const h = harness();
          await h.inboundFromPo.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "inbound-gr-setup",
            sku: SKU,
            quantity: 5,
            refType: "purchase_order",
            refId: PO_ID,
          });
          await h.goodsReceived.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "receive-1",
            sku: SKU,
            quantity: 5,
            refType: "purchase_order",
            refId: PO_ID,
          });
          return h;
        },
      ],
      [
        "InboundCancelled",
        { onHand: 0, onOrder: 7, allocated: 0, available: 0 },
        async () => {
          const h = harness();
          await h.inboundFromPo.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "inbound-cancel-setup",
            sku: SKU,
            quantity: 10,
            refType: "purchase_order",
            refId: PO_ID,
          });
          await h.inboundCancelled.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "cancel-inbound-1",
            sku: SKU,
            quantity: 3,
            refType: "purchase_order",
            refId: PO_ID,
          });
          return h;
        },
      ],
      [
        "Allocated",
        { onHand: 10, onOrder: 0, allocated: 4, available: 6 },
        async () => {
          const h = harness();
          await h.adjustmentIncrease.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "adj-setup-alloc",
            sku: SKU,
            quantity: 10,
            refType: "adjustment",
            refId: "adj-setup-alloc",
          });
          await h.allocated.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "alloc-1",
            sku: SKU,
            quantity: 4,
            refType: "sales_order",
            refId: SO_ID,
          });
          return h;
        },
      ],
      [
        "Deallocated",
        { onHand: 10, onOrder: 0, allocated: 0, available: 10 },
        async () => {
          const h = harness();
          await h.adjustmentIncrease.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "adj-setup-dealloc",
            sku: SKU,
            quantity: 10,
            refType: "adjustment",
            refId: "adj-setup-dealloc",
          });
          await h.allocated.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "alloc-before-dealloc",
            sku: SKU,
            quantity: 4,
            refType: "sales_order",
            refId: SO_ID,
          });
          await h.deallocated.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "dealloc-1",
            sku: SKU,
            quantity: 4,
            refType: "sales_order",
            refId: SO_ID,
          });
          return h;
        },
      ],
      [
        "Shipped",
        { onHand: 6, onOrder: 0, allocated: 0, available: 6 },
        async () => {
          const h = harness();
          await h.adjustmentIncrease.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "adj-setup-ship",
            sku: SKU,
            quantity: 10,
            refType: "adjustment",
            refId: "adj-setup-ship",
          });
          await h.allocated.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "alloc-before-ship",
            sku: SKU,
            quantity: 4,
            refType: "sales_order",
            refId: SO_ID,
          });
          await h.shipped.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "ship-1",
            sku: SKU,
            quantity: 4,
            refType: "sales_order",
            refId: SO_ID,
          });
          return h;
        },
      ],
      [
        "AdjustmentIncrease",
        { onHand: 3, onOrder: 0, allocated: 0, available: 3 },
        async () => {
          const h = harness();
          await h.adjustmentIncrease.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "adj-inc-1",
            sku: SKU,
            quantity: 3,
            refType: "adjustment",
            refId: "cycle-count-1",
          });
          return h;
        },
      ],
      [
        "AdjustmentDecrease",
        { onHand: 7, onOrder: 0, allocated: 0, available: 7 },
        async () => {
          const h = harness();
          await h.adjustmentIncrease.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "adj-dec-setup",
            sku: SKU,
            quantity: 10,
            refType: "adjustment",
            refId: "adj-dec-setup",
          });
          await h.adjustmentDecrease.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "adj-dec-1",
            sku: SKU,
            quantity: 3,
            refType: "adjustment",
            refId: "shrink-1",
          });
          return h;
        },
      ],
    ])("%s applies the specified snapshot effect", async (_type, expected, run) => {
      const h = (await run()) as ReturnType<typeof harness>;
      expect(await snapshot(h)).toEqual(expected);
    });

    it("covers every movement type", () => {
      expect(MOVEMENT_TYPES).toHaveLength(8);
    });
  });

  it("keeps available equal to onHand minus allocated after mixed movements", async () => {
    const h = harness();
    await h.adjustmentIncrease.execute({

      organizationId: DEFAULT_ORG,
idempotencyKey: "mix-adj",
      sku: SKU,
      quantity: 20,
      refType: "adjustment",
      refId: "mix-adj",
    });
    await h.allocated.execute({

      organizationId: DEFAULT_ORG,
idempotencyKey: "mix-alloc-a",
      sku: SKU,
      quantity: 6,
      refType: "sales_order",
      refId: SO_ID,
    });
    await h.allocated.execute({

      organizationId: DEFAULT_ORG,
idempotencyKey: "mix-alloc-b",
      sku: SKU,
      quantity: 5,
      refType: "sales_order",
      refId: SO_ID_2,
    });
    const figures = await snapshot(h);
    expect(figures.available).toBe(figures.onHand - figures.allocated);
    expect(figures).toEqual({
      onHand: 20,
      onOrder: 0,
      allocated: 11,
      available: 9,
    });
  });

  it("returns immutable snapshot figures from the read model", async () => {
    const h = harness();
    h.readModel.seedSnapshot(SKU, DEFAULT, {
      onHand: 2,
      onOrder: 1,
      allocated: 1,
      available: 1,
    }, DEFAULT_ORG);
    const first = await snapshot(h);
    expect(Object.isFrozen(first)).toBe(true);
    expect(() => {
      (first as { onHand: number }).onHand = 99;
    }).toThrow();
    const second = await snapshot(h);
    expect(second.onHand).toBe(2);
  });

  describe("quantity guards", () => {
    it.each([0, -1, -10])("rejects quantity %i", async (quantity) => {
      const h = harness();
      const result = await h.inboundFromPo.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey: `qty-${String(quantity)}`,
        sku: SKU,
        quantity,
        refType: "purchase_order",
        refId: PO_ID,
      });
      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }
      expect(result.reason).toBe("invalid_quantity");
      expect(await movements(h)).toHaveLength(0);
    });
  });

  describe("AdjustmentDecrease guards", () => {
    it("rejects a decrease that would make onHand negative", async () => {
      const h = harness();
      await h.adjustmentIncrease.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey: "adj-guard-onhand",
        sku: SKU,
        quantity: 5,
        refType: "adjustment",
        refId: "adj-guard-onhand",
      });
      const result = await h.adjustmentDecrease.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey: "adj-dec-too-much-onhand",
        sku: SKU,
        quantity: 6,
        refType: "adjustment",
        refId: "adj-dec-too-much-onhand",
      });
      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }
      expect(result.reason).toBe("insufficient_on_hand");
      expect(await snapshot(h)).toEqual({
        onHand: 5,
        onOrder: 0,
        allocated: 0,
        available: 5,
      });
    });

    it("rejects a decrease that would make available negative while stock is allocated", async () => {
      const h = harness();
      await h.adjustmentIncrease.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey: "adj-guard-available",
        sku: SKU,
        quantity: 10,
        refType: "adjustment",
        refId: "adj-guard-available",
      });
      await h.allocated.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey: "adj-guard-alloc",
        sku: SKU,
        quantity: 8,
        refType: "sales_order",
        refId: SO_ID,
      });
      const result = await h.adjustmentDecrease.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey: "adj-dec-too-much-available",
        sku: SKU,
        quantity: 5,
        refType: "adjustment",
        refId: "adj-dec-too-much-available",
      });
      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }
      expect(result.reason).toBe("insufficient_available");
      expect(await snapshot(h)).toEqual({
        onHand: 10,
        onOrder: 0,
        allocated: 8,
        available: 2,
      });
    });
  });

  describe("idempotency at (idempotencyKey, sku)", () => {
    it("treats the same key and payload as a no-op success without a duplicate movement", async () => {
      const h = harness();
      const command = {
        organizationId: DEFAULT_ORG,
        idempotencyKey: "idem-1",
        sku: SKU,
        quantity: 4,
        refType: "purchase_order" as const,
        refId: PO_ID,
      };
      const first = await h.inboundFromPo.execute(command);
      const second = await h.inboundFromPo.execute(command);
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      expect(await movements(h)).toHaveLength(1);
      expect(await snapshot(h)).toEqual({
        onHand: 0,
        onOrder: 4,
        allocated: 0,
        available: 0,
      });
    });

    it("rejects the same key with a different payload", async () => {
      const h = harness();
      const first = await h.inboundFromPo.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey: "idem-conflict",
        sku: SKU,
        quantity: 4,
        refType: "purchase_order",
        refId: PO_ID,
      });
      expect(first.ok).toBe(true);
      const second = await h.inboundFromPo.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey: "idem-conflict",
        sku: SKU,
        quantity: 5,
        refType: "purchase_order",
        refId: PO_ID,
      });
      expect(second.ok).toBe(false);
      if (second.ok) {
        return;
      }
      expect(second.reason).toBe("idempotency_conflict");
      expect(await movements(h)).toHaveLength(1);
      expect(await snapshot(h)).toEqual({
        onHand: 0,
        onOrder: 4,
        allocated: 0,
        available: 0,
      });
    });

    it("scopes idempotency per sku for multi-line commands", async () => {
      const h = harness();
      await h.inboundFromPo.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey: "multi-sku",
        sku: SKU,
        quantity: 2,
        refType: "purchase_order",
        refId: PO_ID,
      });
      await h.inboundFromPo.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey: "multi-sku",
        sku: OTHER_SKU,
        quantity: 3,
        refType: "purchase_order",
        refId: PO_ID,
      });
      expect(await h.readModel.listMovements({ organizationId: DEFAULT_ORG })).toHaveLength(2);
      expect(await h.getSnapshot.execute({
 organizationId: DEFAULT_ORG,
sku: SKU })).toEqual({
        onHand: 0,
        onOrder: 2,
        allocated: 0,
        available: 0,
      });
      expect(await h.getSnapshot.execute({
 organizationId: DEFAULT_ORG,
sku: OTHER_SKU })).toEqual({
        onHand: 0,
        onOrder: 3,
        allocated: 0,
        available: 0,
      });
    });
  });

  describe("once-only provenance at (refType, refId, sku, movementType)", () => {
    it.each(ONCE_ONLY_PROVENANCE_TYPES)(
      "rejects duplicate %s even under a new idempotency key",
      async (movementType) => {
        const h = harness();
        if (movementType === "InboundFromPo" || movementType === "InboundCancelled") {
          await h.inboundFromPo.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "prov-setup",
            sku: SKU,
            quantity: 5,
            refType: "purchase_order",
            refId: PO_ID,
          });
        }
        if (
          movementType === "Allocated" ||
          movementType === "Deallocated" ||
          movementType === "Shipped"
        ) {
          await h.adjustmentIncrease.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "prov-onhand",
            sku: SKU,
            quantity: 10,
            refType: "adjustment",
            refId: "prov-onhand",
          });
          if (movementType === "Deallocated" || movementType === "Shipped") {
            await h.allocated.execute({

              organizationId: DEFAULT_ORG,
idempotencyKey: "prov-alloc-setup",
              sku: SKU,
              quantity: 4,
              refType: "sales_order",
              refId: SO_ID,
            });
          }
        }

        const first = await executeProvenanceCommand(h, movementType, "prov-first");
        const countAfterFirst = (await movements(h)).length;
        const second = await executeProvenanceCommand(h, movementType, "prov-second");
        expect(first.ok).toBe(true);
        expect(second.ok).toBe(false);
        if (second.ok) {
          return;
        }
        expect(second.reason).toBe("provenance_conflict");
        expect(await movements(h)).toHaveLength(countAfterFirst);
      },
    );

    it("allows multiple GoodsReceived movements for partial receipts", async () => {
      const h = harness();
      await h.inboundFromPo.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey: "partial-inbound",
        sku: SKU,
        quantity: 10,
        refType: "purchase_order",
        refId: PO_ID,
      });
      const first = await h.goodsReceived.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey: "partial-receive-1",
        sku: SKU,
        quantity: 4,
        refType: "purchase_order",
        refId: PO_ID,
      });
      const second = await h.goodsReceived.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey: "partial-receive-2",
        sku: SKU,
        quantity: 3,
        refType: "purchase_order",
        refId: PO_ID,
      });
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      expect(await movements(h)).toHaveLength(3);
      expect(await snapshot(h)).toEqual({
        onHand: 7,
        onOrder: 3,
        allocated: 0,
        available: 7,
      });
    });

    it("allows repeated adjustments against the same sku", async () => {
      const h = harness();
      const first = await h.adjustmentIncrease.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey: "repeat-adj-1",
        sku: SKU,
        quantity: 2,
        refType: "adjustment",
        refId: "count-1",
      });
      const second = await h.adjustmentIncrease.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey: "repeat-adj-2",
        sku: SKU,
        quantity: 3,
        refType: "adjustment",
        refId: "count-2",
      });
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      expect(await movements(h)).toHaveLength(2);
      expect(await snapshot(h)).toEqual({
        onHand: 5,
        onOrder: 0,
        allocated: 0,
        available: 5,
      });
    });
  });

  describe("unit of work rollback", () => {
    it("leaves movements and snapshots unchanged when work fails", async () => {
      const h = harness();
      await h.adjustmentIncrease.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey: "rollback-seed",
        sku: SKU,
        quantity: 5,
        refType: "adjustment",
        refId: "rollback-seed",
      });
      const beforeSnapshot = await snapshot(h);
      const beforeMovements = await movements(h);

      await expect(
        h.uow.run(async (scope) => {
          const decrease = new RecordAdjustmentDecreaseUseCase(scope.ledger);
          const result = await decrease.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "rollback-fail",
            sku: SKU,
            quantity: 10,
            refType: "adjustment",
            refId: "rollback-fail",
          });
          if (!result.ok) {
            throw new Error(result.reason);
          }
        }),
      ).rejects.toThrow();

      expect(await snapshot(h)).toEqual(beforeSnapshot);
      expect(await movements(h)).toEqual(beforeMovements);
    });

    it("forgets idempotency from a rolled-back movement", async () => {
      const h = harness();
      await h.adjustmentIncrease.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey: "rollback-keep",
        sku: SKU,
        quantity: 5,
        refType: "adjustment",
        refId: "rollback-keep",
      });

      await expect(
        h.uow.run(async (scope) => {
          const increase = new RecordAdjustmentIncreaseUseCase(scope.ledger);
          const result = await increase.execute({

            organizationId: DEFAULT_ORG,
idempotencyKey: "rollback-idempotency",
            sku: SKU,
            quantity: 1,
            refType: "adjustment",
            refId: "rollback-idempotency",
          });
          expect(result.ok).toBe(true);
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");

      const retried = await h.adjustmentIncrease.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey: "rollback-idempotency",
        sku: SKU,
        quantity: 1,
        refType: "adjustment",
        refId: "rollback-idempotency",
      });
      expect(retried.ok).toBe(true);
      expect(await movements(h)).toHaveLength(2);
    });
  });

  describe("serialized allocation", () => {
    it("cannot allocate more than available across two successful commands", async () => {
      const h = harness();
      await h.adjustmentIncrease.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey: "oversell-seed",
        sku: SKU,
        quantity: 10,
        refType: "adjustment",
        refId: "oversell-seed",
      });

      const first = await h.uow.run((scope) =>
        new RecordAllocatedUseCase(scope.ledger).execute({

          organizationId: DEFAULT_ORG,
idempotencyKey: "oversell-a",
          sku: SKU,
          quantity: 8,
          refType: "sales_order",
          refId: SO_ID,
        }),
      );
      const second = await h.uow.run((scope) =>
        new RecordAllocatedUseCase(scope.ledger).execute({

          organizationId: DEFAULT_ORG,
idempotencyKey: "oversell-b",
          sku: SKU,
          quantity: 8,
          refType: "sales_order",
          refId: SO_ID_2,
        }),
      );

      const successes = [first, second].filter((result) => result.ok);
      expect(successes).toHaveLength(1);
      expect(await snapshot(h)).toEqual({
        onHand: 10,
        onOrder: 0,
        allocated: 8,
        available: 2,
      });
    });
  });

  describe("organization isolation", () => {
    it("receive and allocate in Acme does not change Beta available for the same SKU string", async () => {
      const h = harness();

      await h.adjustmentIncrease.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "acme-receive",
        sku: WIDGET_SKU,
        quantity: 10,
        refType: "adjustment",
        refId: "acme-receive",
      });
      await h.allocated.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: "acme-alloc",
        sku: WIDGET_SKU,
        quantity: 4,
        refType: "sales_order",
        refId: SO_ID,
      });

      const acme = await h.getSnapshot.execute({
        organizationId: DEFAULT_ORG,
        sku: WIDGET_SKU,
        locationId: DEFAULT,
      });
      expect(acme).toEqual({
        onHand: 10,
        onOrder: 0,
        allocated: 4,
        available: 6,
      });

      const beta = await h.getSnapshot.execute({
        organizationId: BETA_ORG,
        sku: WIDGET_SKU,
        locationId: DEFAULT,
      });
      expect(beta).toEqual({
        onHand: 0,
        onOrder: 0,
        allocated: 0,
        available: 0,
      });
    });

    it("allows the same idempotency key and SKU in two organizations independently", async () => {
      const h = harness();
      const sharedKey = "shared-idempotency-key";

      const acme = await h.adjustmentIncrease.execute({
        organizationId: DEFAULT_ORG,
        idempotencyKey: sharedKey,
        sku: WIDGET_SKU,
        quantity: 3,
        refType: "adjustment",
        refId: "acme-shared-key",
      });
      const beta = await h.adjustmentIncrease.execute({
        organizationId: BETA_ORG,
        idempotencyKey: sharedKey,
        sku: WIDGET_SKU,
        quantity: 5,
        refType: "adjustment",
        refId: "beta-shared-key",
      });

      expect(acme.ok).toBe(true);
      expect(beta.ok).toBe(true);
      expect(await h.getSnapshot.execute({
        organizationId: DEFAULT_ORG,
        sku: WIDGET_SKU,
        locationId: DEFAULT,
      })).toEqual({
        onHand: 3,
        onOrder: 0,
        allocated: 0,
        available: 3,
      });
      expect(await h.getSnapshot.execute({
        organizationId: BETA_ORG,
        sku: WIDGET_SKU,
        locationId: DEFAULT,
      })).toEqual({
        onHand: 5,
        onOrder: 0,
        allocated: 0,
        available: 5,
      });
    });
  });

  it("keeps application/ free of Fastify, Drizzle, Zod, Better Auth, Stripe, tax SDKs, Sentry, or logger SDKs", () => {
    const applicationDir = resolve(import.meta.dirname, "../src/application");
    const forbidden = [
      "fastify",
      "drizzle",
      "zod",
      "better-auth",
      "stripe",
      "sentry",
      "@sentry",
      "pino",
    ];
    for (const file of readdirSync(applicationDir)) {
      if (!file.endsWith(".ts")) {
        continue;
      }
      const source = readFileSync(resolve(applicationDir, file), "utf8").toLowerCase();
      for (const token of forbidden) {
        expect(source.includes(token), `${file} must not reference ${token}`).toBe(false);
      }
    }
  });
});

async function executeProvenanceCommand(
  h: ReturnType<typeof harness>,
  movementType: (typeof ONCE_ONLY_PROVENANCE_TYPES)[number],
  idempotencyKey: string,
) {
  switch (movementType) {
    case "InboundFromPo":
      return h.inboundFromPo.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey,
        sku: SKU,
        quantity: 5,
        refType: "purchase_order",
        refId: PO_ID_2,
      });
    case "InboundCancelled":
      return h.inboundCancelled.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey,
        sku: SKU,
        quantity: 5,
        refType: "purchase_order",
        refId: PO_ID,
      });
    case "Allocated":
      return h.allocated.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey,
        sku: SKU,
        quantity: 4,
        refType: "sales_order",
        refId: SO_ID_2,
      });
    case "Deallocated":
      return h.deallocated.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey,
        sku: SKU,
        quantity: 4,
        refType: "sales_order",
        refId: SO_ID,
      });
    case "Shipped":
      return h.shipped.execute({

        organizationId: DEFAULT_ORG,
idempotencyKey,
        sku: SKU,
        quantity: 4,
        refType: "sales_order",
        refId: SO_ID,
      });
  }
}
