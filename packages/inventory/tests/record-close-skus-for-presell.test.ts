import {
  OrganizationId,
  PurchaseOrderId,
  Sku,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { RecordCloseSkusForPresellUseCase } from "../src/application/record-close-skus-for-presell.js";
import { demandModelHarness } from "./support/demand-model-harness.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const PO_ID = PurchaseOrderId.parse("550e8400-e29b-41d4-a716-446655440010");
const CLOSE_A = Sku.parse("CLOSE-UC-A");
const CLOSE_B = Sku.parse("CLOSE-UC-B");
const WINDOW_OPENS = new Date("2026-07-01T00:00:00.000Z");
const WINDOW_CLOSES = new Date("2026-08-01T00:00:00.000Z");
const INSIDE_WINDOW = new Date("2026-07-15T12:00:00.000Z");

async function lockSku(
  h: ReturnType<typeof demandModelHarness>,
  sku: Sku,
  idempotencyKey: string,
) {
  await h.inboundFromPo.execute({
    organizationId: DEFAULT_ORG,
    idempotencyKey,
    sku,
    quantity: 10,
    refType: "purchase_order",
    refId: PO_ID,
  });
}

describe("RecordCloseSkusForPresellUseCase", () => {
  it("closes listed SKUs using sticky lock observation", async () => {
    const h = demandModelHarness(INSIDE_WINDOW);
    await lockSku(h, CLOSE_A, "close-uc-a");
    await lockSku(h, CLOSE_B, "close-uc-b");

    await h.reopenSkusForPresell({
      organizationId: DEFAULT_ORG,
      skus: [CLOSE_A, CLOSE_B],
      windowOpensAt: WINDOW_OPENS,
      windowClosesAt: WINDOW_CLOSES,
    });

    const useCase = new RecordCloseSkusForPresellUseCase(h.uow.ledger);
    const result = await useCase.execute({
      organizationId: DEFAULT_ORG,
      skus: [CLOSE_A, CLOSE_B],
    });
    expect(result).toEqual({ ok: true, closedCount: 2 });

    const closedA = await h.demandSnapshot(CLOSE_A);
    const closedB = await h.demandSnapshot(CLOSE_B);
    expect(closedA.sellState).toBe("locked");
    expect(closedB.sellState).toBe("locked");
    expect(closedA.stickyLocked).toBe(true);
    expect(closedB.stickyLocked).toBe(true);
  });

  it("skips SKUs that are already sticky locked", async () => {
    const h = demandModelHarness();
    await lockSku(h, CLOSE_A, "close-uc-already");

    const useCase = new RecordCloseSkusForPresellUseCase(h.uow.ledger);
    const result = await useCase.execute({
      organizationId: DEFAULT_ORG,
      skus: [CLOSE_A],
    });
    expect(result).toEqual({ ok: true, closedCount: 0 });
  });
});
