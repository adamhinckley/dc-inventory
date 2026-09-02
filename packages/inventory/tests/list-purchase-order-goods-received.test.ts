import {
  LocationId,
  OrganizationId,
  PurchaseOrderId,
  Sku,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { ListPurchaseOrderGoodsReceivedUseCase } from "../src/application/list-purchase-order-goods-received.js";
import type { IPurchaseOrderLookup } from "../src/domain/ports/purchase-order-lookup.js";
import { demandModelHarness } from "./support/demand-model-harness.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const SKU = Sku.parse("PO-GR-HIST-SKU");
const PO_TARGET = PurchaseOrderId.parse("550e8400-e29b-41d4-a716-446655440090");
const PO_OTHER = PurchaseOrderId.parse("550e8400-e29b-41d4-a716-446655440091");
const PO_MISSING = PurchaseOrderId.parse("550e8400-e29b-41d4-a716-446655440099");

class StubPurchaseOrderLookup implements IPurchaseOrderLookup {
  constructor(private readonly existing: ReadonlySet<string>) {}

  async exists(
    _organizationId: OrganizationId,
    purchaseOrderId: PurchaseOrderId,
  ): Promise<boolean> {
    return this.existing.has(purchaseOrderId);
  }
}

function harness(existingPoIds: readonly PurchaseOrderId[] = [PO_TARGET, PO_OTHER]) {
  const monday = new Date("2026-03-02T10:00:00.000Z");
  const clock = new InMemoryClock(monday);
  const h = demandModelHarness(clock);
  const lookup = new StubPurchaseOrderLookup(new Set(existingPoIds));
  return {
    ...h,
    clock,
    listGoodsReceived: new ListPurchaseOrderGoodsReceivedUseCase(h.readModel, lookup),
    monday,
  };
}

describe("ListPurchaseOrderGoodsReceivedUseCase (ADA-235)", () => {
  it("returns not_found when the purchase order does not exist", async () => {
    const h = harness([PO_TARGET]);
    const result = await h.listGoodsReceived.execute({
      organizationId: DEFAULT_ORG,
      purchaseOrderId: PO_MISSING,
    });
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns an empty array when the purchase order exists but has no GoodsReceived rows", async () => {
    const h = harness([PO_TARGET]);
    const result = await h.listGoodsReceived.execute({
      organizationId: DEFAULT_ORG,
      purchaseOrderId: PO_TARGET,
    });
    expect(result).toEqual({ ok: true, items: [] });
  });

  it("returns two partial receives ordered by createdAt ascending", async () => {
    const h = harness();
    await h.inboundFromPo.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "gr-hist-inbound",
      sku: SKU,
      quantity: 100,
      refType: "purchase_order",
      refId: PO_TARGET,
    });

    const first = await h.goodsReceived.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "gr-hist-receive-mon",
      sku: SKU,
      quantity: 40,
      refType: "purchase_order",
      refId: PO_TARGET,
    });
    expect(first.ok).toBe(true);

    h.clock.advance(4 * 24 * 60 * 60 * 1000);

    const second = await h.goodsReceived.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "gr-hist-receive-fri",
      sku: SKU,
      quantity: 60,
      refType: "purchase_order",
      refId: PO_TARGET,
    });
    expect(second.ok).toBe(true);

    const result = await h.listGoodsReceived.execute({
      organizationId: DEFAULT_ORG,
      purchaseOrderId: PO_TARGET,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ sku: SKU, quantity: 40 });
    expect(result.items[1]).toMatchObject({ sku: SKU, quantity: 60 });
    expect(result.items[0]!.createdAt.getTime()).toBeLessThan(
      result.items[1]!.createdAt.getTime(),
    );
    expect(result.items[0]!.createdAt.toISOString()).toBe("2026-03-02T10:00:00.000Z");
    expect(result.items[1]!.createdAt.toISOString()).toBe("2026-03-06T10:00:00.000Z");
  });

  it("excludes GoodsReceived for other purchase orders", async () => {
    const h = harness();
    await h.inboundFromPo.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "gr-hist-other-inbound",
      sku: SKU,
      quantity: 10,
      refType: "purchase_order",
      refId: PO_OTHER,
    });
    await h.goodsReceived.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "gr-hist-other-receive",
      sku: SKU,
      quantity: 10,
      refType: "purchase_order",
      refId: PO_OTHER,
    });

    await h.inboundFromPo.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "gr-hist-target-inbound",
      sku: SKU,
      quantity: 5,
      refType: "purchase_order",
      refId: PO_TARGET,
    });
    await h.goodsReceived.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "gr-hist-target-receive",
      sku: SKU,
      quantity: 5,
      refType: "purchase_order",
      refId: PO_TARGET,
    });

    const result = await h.listGoodsReceived.execute({
      organizationId: DEFAULT_ORG,
      purchaseOrderId: PO_TARGET,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.items).toEqual([
      expect.objectContaining({ sku: SKU, quantity: 5 }),
    ]);
  });

  it("excludes InboundFromPo and InboundCancelled movements", async () => {
    const h = harness();
    await h.inboundFromPo.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "gr-hist-inbound-only",
      sku: SKU,
      quantity: 20,
      refType: "purchase_order",
      refId: PO_TARGET,
    });
    await h.goodsReceived.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "gr-hist-receive-only",
      sku: SKU,
      quantity: 8,
      refType: "purchase_order",
      refId: PO_TARGET,
    });
    await h.inboundCancelled.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "gr-hist-cancel-remainder",
      sku: SKU,
      quantity: 12,
      refType: "purchase_order",
      refId: PO_TARGET,
    });

    const result = await h.listGoodsReceived.execute({
      organizationId: DEFAULT_ORG,
      purchaseOrderId: PO_TARGET,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.items).toEqual([
      expect.objectContaining({ sku: SKU, quantity: 8 }),
    ]);
  });

  it("scopes movements to the default location", async () => {
    const h = harness();
    const otherLocation = LocationId.parse("660e8400-e29b-41d4-a716-446655440010");
    await h.inboundFromPo.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "gr-hist-default-inbound",
      sku: SKU,
      quantity: 10,
      refType: "purchase_order",
      refId: PO_TARGET,
    });
    await h.goodsReceived.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "gr-hist-default-receive",
      sku: SKU,
      quantity: 10,
      refType: "purchase_order",
      refId: PO_TARGET,
    });
    await h.inboundFromPo.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "gr-hist-other-loc-inbound",
      sku: SKU,
      quantity: 3,
      locationId: otherLocation,
      refType: "purchase_order",
      refId: PO_TARGET,
    });
    await h.goodsReceived.execute({
      organizationId: DEFAULT_ORG,
      idempotencyKey: "gr-hist-other-loc-receive",
      sku: SKU,
      quantity: 3,
      locationId: otherLocation,
      refType: "purchase_order",
      refId: PO_TARGET,
    });

    const result = await h.listGoodsReceived.execute({
      organizationId: DEFAULT_ORG,
      purchaseOrderId: PO_TARGET,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.items).toEqual([
      expect.objectContaining({ sku: SKU, quantity: 10 }),
    ]);
  });
});
