import {
  OrganizationId,
  PurchaseOrderId,
  Sku,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { InMemorySellWindowRepository } from "../src/adapters/in-memory-sell-window-repository.js";
import { CreateSellWindowUseCase } from "../src/application/create-sell-window.js";
import { GetSellWindowUseCase } from "../src/application/get-sell-window.js";
import { ListSellWindowsUseCase } from "../src/application/list-sell-windows.js";
import {
  RecordReopenSkusForPresellUseCase,
  SellWindowPersistenceError,
} from "../src/application/record-reopen-skus-for-presell.js";
import type {
  CreateSellWindowRecord,
  ISellWindowRepository,
} from "../src/domain/ports/sell-window-repository.js";
import { demandModelHarness } from "./support/demand-model-harness.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const STAFF = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const PO_ID = PurchaseOrderId.parse("550e8400-e29b-41d4-a716-446655440010");
const REOPEN_A = Sku.parse("REOPEN-UC-A");
const REOPEN_B = Sku.parse("REOPEN-UC-B");
const WINDOW_OPENS = new Date("2026-07-15T00:00:00.000Z");
const WINDOW_CLOSES = new Date("2026-08-01T00:00:00.000Z");
const INSIDE_WINDOW = new Date("2026-07-15T12:00:00.000Z");
const SCHEDULED_OPENS = new Date("2026-07-01T00:00:00.000Z");

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

function reopenUseCase(h: ReturnType<typeof demandModelHarness>) {
  const sellWindowRepo = new InMemorySellWindowRepository();
  const clock = new InMemoryClock(INSIDE_WINDOW);
  return {
    sellWindowRepo,
    clock,
    useCase: new RecordReopenSkusForPresellUseCase(
      h.uow.ledger,
      new CreateSellWindowUseCase(sellWindowRepo, clock),
      clock,
    ),
    list: new ListSellWindowsUseCase(sellWindowRepo, clock),
    get: new GetSellWindowUseCase(sellWindowRepo, clock),
  };
}

class FailingSellWindowRepository implements ISellWindowRepository {
  constructor(private readonly inner: ISellWindowRepository) {}

  async create(_record: CreateSellWindowRecord): Promise<void> {
    throw new SellWindowPersistenceError("invalid");
  }

  list(query: Parameters<ISellWindowRepository["list"]>[0]) {
    return this.inner.list(query);
  }

  findById(
    organizationId: Parameters<ISellWindowRepository["findById"]>[0],
    id: Parameters<ISellWindowRepository["findById"]>[1],
  ) {
    return this.inner.findById(organizationId, id);
  }

  close(
    organizationId: Parameters<ISellWindowRepository["close"]>[0],
    id: Parameters<ISellWindowRepository["close"]>[1],
    manuallyClosedAt: Parameters<ISellWindowRepository["close"]>[2],
  ) {
    return this.inner.close(organizationId, id, manuallyClosedAt);
  }
}

describe("RecordReopenSkusForPresellUseCase", () => {
  it("reopens listed SKUs and persists a sell window with membership", async () => {
    const h = demandModelHarness(INSIDE_WINDOW);
    await lockSku(h, REOPEN_A, "reopen-uc-a");
    await lockSku(h, REOPEN_B, "reopen-uc-b");

    const { useCase, list, get } = reopenUseCase(h);
    const result = await useCase.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF,
      name: "Summer pre-sell",
      filterSnapshot: { q: "REOPEN" },
      skus: [REOPEN_A, REOPEN_B],
      windowOpensAt: WINDOW_OPENS,
      windowClosesAt: WINDOW_CLOSES,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected reopen ok");
    }
    expect(result.reopenedCount).toBe(2);
    expect(result.sellWindow.skuCount).toBe(2);
    expect(result.sellWindow.status).toBe("open");

    const reopenedA = await h.demandSnapshot(REOPEN_A);
    const reopenedB = await h.demandSnapshot(REOPEN_B);
    expect(reopenedA.sellState).toBe("open");
    expect(reopenedB.sellState).toBe("open");
    expect(reopenedA.windowOpensAt?.toISOString()).toBe(WINDOW_OPENS.toISOString());
    expect(reopenedA.windowClosesAt?.toISOString()).toBe(WINDOW_CLOSES.toISOString());

    const listed = await list.execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 25,
    });
    expect(listed.total).toBe(1);
    expect(listed.items[0]?.id).toBe(result.sellWindow.id);
    expect(listed.items[0]?.skuCount).toBe(2);

    const got = await get.execute({
      organizationId: DEFAULT_ORG,
      id: result.sellWindow.id,
    });
    expect(got.ok).toBe(true);
    if (!got.ok) {
      throw new Error("expected get ok");
    }
    expect(got.window.skus.map((sku) => sku.value)).toEqual([REOPEN_A.value, REOPEN_B.value]);
  });

  it("rejects invalid sell windows", async () => {
    const h = demandModelHarness();
    await lockSku(h, REOPEN_A, "reopen-uc-invalid");

    const { useCase } = reopenUseCase(h);
    const result = await useCase.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF,
      name: "Bad window",
      filterSnapshot: {},
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

  it("rejects a window that opens before today", async () => {
    const h = demandModelHarness(INSIDE_WINDOW);
    await lockSku(h, REOPEN_A, "reopen-uc-past");
    const { useCase } = reopenUseCase(h);
    const result = await useCase.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF,
      name: "Past open",
      filterSnapshot: {},
      skus: [REOPEN_A],
      windowOpensAt: SCHEDULED_OPENS,
      windowClosesAt: WINDOW_CLOSES,
    });
    expect(result).toEqual({ ok: false, reason: "invalid_sell_window" });
  });

  it("rejects an empty SKU list", async () => {
    const h = demandModelHarness();
    const { useCase } = reopenUseCase(h);
    const result = await useCase.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF,
      name: "No SKUs",
      filterSnapshot: {},
      skus: [],
      windowClosesAt: WINDOW_CLOSES,
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("rolls back snapshot reopen when sell window persistence fails", async () => {
    const h = demandModelHarness(INSIDE_WINDOW);
    await lockSku(h, REOPEN_A, "reopen-uc-rollback");
    const sellWindowRepo = new InMemorySellWindowRepository();
    const clock = new InMemoryClock(INSIDE_WINDOW);

    await expect(
      h.uow.run(async (scope) =>
        new RecordReopenSkusForPresellUseCase(
          scope.ledger,
          new CreateSellWindowUseCase(
            new FailingSellWindowRepository(sellWindowRepo),
            clock,
          ),
          clock,
        ).execute({
          organizationId: DEFAULT_ORG,
          staffUserId: STAFF,
          name: "Rollback test",
          filterSnapshot: {},
          skus: [REOPEN_A],
          windowClosesAt: WINDOW_CLOSES,
        }),
      ),
    ).rejects.toThrow(SellWindowPersistenceError);

    const snapshot = await h.demandSnapshot(REOPEN_A);
    expect(snapshot.sellState).toBe("locked");
    expect(snapshot.windowClosesAt).toBeNull();

    const listed = await new ListSellWindowsUseCase(sellWindowRepo, clock).execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 25,
    });
    expect(listed.total).toBe(0);
  });

  it("marks scheduled windows before opens from the injected clock", async () => {
    const h = demandModelHarness();
    await lockSku(h, REOPEN_A, "reopen-uc-scheduled");
    const sellWindowRepo = new InMemorySellWindowRepository();
    const beforeOpens = new Date("2026-06-15T12:00:00.000Z");
    const useCase = new RecordReopenSkusForPresellUseCase(
      h.uow.ledger,
      new CreateSellWindowUseCase(sellWindowRepo, new InMemoryClock(beforeOpens)),
      new InMemoryClock(beforeOpens),
    );
    const result = await useCase.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF,
      name: "Future block",
      filterSnapshot: {},
      skus: [REOPEN_A],
      windowOpensAt: SCHEDULED_OPENS,
      windowClosesAt: WINDOW_CLOSES,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected reopen ok");
    }
    expect(result.sellWindow.status).toBe("scheduled");
  });
});
