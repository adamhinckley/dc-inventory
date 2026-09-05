import {
  OrganizationId,
  PurchaseOrderId,
  Sku,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { RecordReopenSkusForPresellUseCase } from "../src/application/record-reopen-skus-for-presell.js";
import { demandModelHarness } from "./support/demand-model-harness.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const PO_ID = PurchaseOrderId.parse("550e8400-e29b-41d4-a716-446655440010");
const REOPEN_A = Sku.parse("REOPEN-UC-A");
const REOPEN_B = Sku.parse("REOPEN-UC-B");
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

describe("RecordReopenSkusForPresellUseCase", () => {
  it("reopens listed SKUs with an optional shared sell window", async () => {
    const h = demandModelHarness(INSIDE_WINDOW);
    await lockSku(h, REOPEN_A, "reopen-uc-a");
    await lockSku(h, REOPEN_B, "reopen-uc-b");

    const useCase = new RecordReopenSkusForPresellUseCase(h.uow.ledger);
    const result = await useCase.execute({
      organizationId: DEFAULT_ORG,
      skus: [REOPEN_A, REOPEN_B],
      windowOpensAt: WINDOW_OPENS,
      windowClosesAt: WINDOW_CLOSES,
    });
    expect(result.ok).toBe(true);

    const reopenedA = await h.demandSnapshot(REOPEN_A);
    const reopenedB = await h.demandSnapshot(REOPEN_B);
    expect(reopenedA.sellState).toBe("open");
    expect(reopenedB.sellState).toBe("open");
    expect(reopenedA.windowOpensAt?.toISOString()).toBe(WINDOW_OPENS.toISOString());
    expect(reopenedA.windowClosesAt?.toISOString()).toBe(WINDOW_CLOSES.toISOString());
  });

  it("rejects invalid sell windows", async () => {
    const h = demandModelHarness();
    await lockSku(h, REOPEN_A, "reopen-uc-invalid");

    const useCase = new RecordReopenSkusForPresellUseCase(h.uow.ledger);
    const result = await useCase.execute({
      organizationId: DEFAULT_ORG,
      skus: [REOPEN_A],
      windowOpensAt: WINDOW_CLOSES,
      windowClosesAt: WINDOW_OPENS,
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.reason).toBe("invalid_sell_window");
  });
});
