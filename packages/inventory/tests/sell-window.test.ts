import {
  OrganizationId,
  Sku,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { InMemorySellWindowRepository } from "../src/adapters/in-memory-sell-window-repository.js";
import { CloseSellWindowUseCase } from "../src/application/close-sell-window.js";
import { CreateSellWindowUseCase } from "../src/application/create-sell-window.js";
import { GetSellWindowUseCase } from "../src/application/get-sell-window.js";
import { ListSellWindowsUseCase } from "../src/application/list-sell-windows.js";
import { SellWindowId } from "../src/domain/ids.js";

const ORG = OrganizationId.DEFAULT;
const STAFF = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const SKU_A = Sku.parse("SW-A");
const SKU_B = Sku.parse("SW-B");
const OPENS = new Date("2026-07-01T00:00:00.000Z");
const CLOSES = new Date("2026-08-01T00:00:00.000Z");
const INSIDE = new Date("2026-07-15T12:00:00.000Z");
const BEFORE = new Date("2026-06-15T12:00:00.000Z");
const AFTER = new Date("2026-09-01T12:00:00.000Z");

function harness(now: Date) {
  const repo = new InMemorySellWindowRepository();
  const clock = new InMemoryClock(now);
  return {
    repo,
    clock,
    create: new CreateSellWindowUseCase(repo, clock),
    list: new ListSellWindowsUseCase(repo, clock),
    get: new GetSellWindowUseCase(repo, clock),
    close: new CloseSellWindowUseCase(repo, clock),
  };
}

describe("SellWindow repository ports", () => {
  it("creates, lists, and gets a sell window with membership", async () => {
    const h = harness(INSIDE);
    const created = await h.create.execute({
      organizationId: ORG,
      staffUserId: STAFF,
      name: "Summer pre-sell",
      filterSnapshot: {
        q: "hat",
        supplierId: ["550e8400-e29b-41d4-a716-446655440001"],
      },
      windowOpensAt: OPENS,
      windowClosesAt: CLOSES,
      skus: [SKU_A, SKU_B],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("expected create ok");
    }
    expect(created.window.status).toBe("open");
    expect(created.window.skuCount).toBe(2);

    const listed = await h.list.execute({
      organizationId: ORG,
      page: 1,
      pageSize: 25,
    });
    expect(listed.total).toBe(1);
    expect(listed.items[0]?.name).toBe("Summer pre-sell");
    expect(listed.items[0]?.status).toBe("open");

    const got = await h.get.execute({
      organizationId: ORG,
      id: created.window.id,
    });
    expect(got.ok).toBe(true);
    if (!got.ok) {
      throw new Error("expected get ok");
    }
    expect(got.window.status).toBe("open");
    expect(got.window.skus.map((sku) => sku.value)).toEqual([SKU_A.value, SKU_B.value]);
  });

  it("marks scheduled windows before opens and closed after closes on list/get", async () => {
    const repo = new InMemorySellWindowRepository();
    const created = await new CreateSellWindowUseCase(repo, new InMemoryClock(BEFORE)).execute({
      organizationId: ORG,
      staffUserId: STAFF,
      name: "Future block",
      filterSnapshot: {},
      windowOpensAt: OPENS,
      windowClosesAt: CLOSES,
      skus: [SKU_A],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("expected create ok");
    }
    expect(created.window.status).toBe("scheduled");

    const listedOpen = await new ListSellWindowsUseCase(repo, new InMemoryClock(INSIDE)).execute({
      organizationId: ORG,
      page: 1,
      pageSize: 25,
    });
    expect(listedOpen.items[0]?.status).toBe("open");

    const gotClosed = await new GetSellWindowUseCase(repo, new InMemoryClock(AFTER)).execute({
      organizationId: ORG,
      id: created.window.id,
    });
    expect(gotClosed.ok).toBe(true);
    if (!gotClosed.ok) {
      throw new Error("expected get ok");
    }
    expect(gotClosed.window.status).toBe("closed");
  });

  it("dedupes skus before persisting membership", async () => {
    const h = harness(INSIDE);
    const created = await h.create.execute({
      organizationId: ORG,
      staffUserId: STAFF,
      name: "Deduped",
      filterSnapshot: {},
      windowClosesAt: CLOSES,
      skus: [SKU_A, SKU_A, SKU_B],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("expected create ok");
    }
    expect(created.window.skuCount).toBe(2);

    const got = await h.get.execute({
      organizationId: ORG,
      id: created.window.id,
    });
    expect(got.ok).toBe(true);
    if (!got.ok) {
      throw new Error("expected get ok");
    }
    expect(got.window.skus.map((sku) => sku.value)).toEqual([SKU_A.value, SKU_B.value]);
  });

  it("rejects invalid sell windows", async () => {
    const h = harness(INSIDE);
    const created = await h.create.execute({
      organizationId: ORG,
      staffUserId: STAFF,
      name: "Bad window",
      filterSnapshot: {},
      windowOpensAt: CLOSES,
      windowClosesAt: OPENS,
      skus: [SKU_A],
    });
    expect(created).toEqual({ ok: false, reason: "invalid_sell_window" });
  });

  it("closes a window by setting manuallyClosedAt", async () => {
    const h = harness(INSIDE);
    const created = await h.create.execute({
      organizationId: ORG,
      staffUserId: STAFF,
      name: "Closable",
      filterSnapshot: {},
      windowClosesAt: CLOSES,
      skus: [SKU_A],
    });
    if (!created.ok) {
      throw new Error("expected create ok");
    }
    const closed = await h.close.execute({
      organizationId: ORG,
      id: created.window.id,
    });
    expect(closed.ok).toBe(true);
    if (!closed.ok) {
      throw new Error("expected close ok");
    }
    expect(closed.window.status).toBe("closed");
    expect(closed.window.manuallyClosedAt).toEqual(INSIDE);

    const again = await h.close.execute({
      organizationId: ORG,
      id: created.window.id,
    });
    expect(again).toEqual({ ok: false, reason: "already_closed" });
  });

  it("treats elapsed windows as already closed", async () => {
    const repo = new InMemorySellWindowRepository();
    const created = await new CreateSellWindowUseCase(repo, new InMemoryClock(INSIDE)).execute({
      organizationId: ORG,
      staffUserId: STAFF,
      name: "Elapsed",
      filterSnapshot: {},
      windowClosesAt: CLOSES,
      skus: [SKU_A],
    });
    if (!created.ok) {
      throw new Error("expected create ok");
    }

    const result = await new CloseSellWindowUseCase(repo, new InMemoryClock(AFTER)).execute({
      organizationId: ORG,
      id: created.window.id,
    });
    expect(result).toEqual({ ok: false, reason: "already_closed" });
  });

  it("returns not_found for unknown ids", async () => {
    const h = harness(INSIDE);
    const got = await h.get.execute({
      organizationId: ORG,
      id: SellWindowId.parse("22222222-2222-4222-8222-222222222222"),
    });
    expect(got).toEqual({ ok: false, reason: "not_found" });
  });
});
