import { describe, expect, it } from "vitest";
import { ReplaceSalesOrderLinesUseCase } from "../src/application/replace-sales-order-lines.js";
import {
  CUSTOMER_ID,
  DEFAULT_ORG,
  LOCK_PRODUCT_ID,
  OPEN_PRODUCT_ID,
  salesDemandHarness,
  WHOLESALE_USER_ID,
  type SalesDemandHarness,
} from "./support/sales-demand-harness.js";

function openDraftsForCustomer(h: SalesDemandHarness) {
  return [...h.uow.salesOrders.snapshot().byId.values()].filter(
    (row) =>
      row.order.organizationId === DEFAULT_ORG &&
      row.order.customerId === CUSTOMER_ID &&
      row.order.status === "draft",
  );
}

describe("multi-cart drafts (one customer, many open drafts)", () => {
  it("opens a second wholesale draft instead of merging into the first", async () => {
    const h = salesDemandHarness();

    const first = await h.createWholesaleDraft(OPEN_PRODUCT_ID, 1);
    const second = await h.createWholesaleDraft(OPEN_PRODUCT_ID, 2);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }

    expect(second.salesOrderId).not.toBe(first.salesOrderId);
    const firstReloaded = await h.uow.salesOrders.findById(DEFAULT_ORG, first.salesOrderId);
    const secondReloaded = await h.uow.salesOrders.findById(DEFAULT_ORG, second.salesOrderId);
    expect(firstReloaded?.lines[0]?.qty).toBe(1);
    expect(secondReloaded?.lines[0]?.qty).toBe(2);
    expect(openDraftsForCustomer(h)).toHaveLength(2);
  });

  it("staff-acting and internal creates also open separate drafts", async () => {
    const h = salesDemandHarness();

    const acting1 = await h.createStaffActingDraft(OPEN_PRODUCT_ID, 1);
    const acting2 = await h.createStaffActingDraft(LOCK_PRODUCT_ID, 1);
    const staff1 = await h.createStaffDraft(OPEN_PRODUCT_ID, 2);
    const staff2 = await h.createStaffDraft(OPEN_PRODUCT_ID, 1);
    for (const result of [acting1, acting2, staff1, staff2]) {
      expect(result.ok).toBe(true);
    }
    if (!acting1.ok || !acting2.ok || !staff1.ok || !staff2.ok) {
      return;
    }

    const ids = new Set([
      acting1.salesOrderId,
      acting2.salesOrderId,
      staff1.salesOrderId,
      staff2.salesOrderId,
    ]);
    expect(ids.size).toBe(4);
    expect(openDraftsForCustomer(h)).toHaveLength(4);
  });

  it("concurrent creates each get their own draft and document number", async () => {
    const h = salesDemandHarness();

    const [first, second] = await Promise.all([
      h.create.execute({
        organizationId: DEFAULT_ORG,
        wholesaleUserId: WHOLESALE_USER_ID,
        customerId: CUSTOMER_ID,
        lines: [{ productId: OPEN_PRODUCT_ID, qty: 2 }],
      }),
      h.create.execute({
        organizationId: DEFAULT_ORG,
        wholesaleUserId: WHOLESALE_USER_ID,
        customerId: CUSTOMER_ID,
        lines: [{ productId: OPEN_PRODUCT_ID, qty: 3 }],
      }),
    ]);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }

    expect(first.salesOrder.id).not.toBe(second.salesOrder.id);
    expect(first.salesOrder.documentNumber).not.toBe(second.salesOrder.documentNumber);
    expect(openDraftsForCustomer(h)).toHaveLength(2);
  });

  it("stores a trimmed cart label on create and drops a blank one", async () => {
    const h = salesDemandHarness();

    const named = await h.create.execute({
      organizationId: DEFAULT_ORG,
      wholesaleUserId: WHOLESALE_USER_ID,
      customerId: CUSTOMER_ID,
      label: "  Spring reorder  ",
      lines: [{ productId: OPEN_PRODUCT_ID, qty: 1 }],
    });
    const blank = await h.create.execute({
      organizationId: DEFAULT_ORG,
      wholesaleUserId: WHOLESALE_USER_ID,
      customerId: CUSTOMER_ID,
      label: "   ",
      lines: [{ productId: OPEN_PRODUCT_ID, qty: 1 }],
    });
    expect(named.ok).toBe(true);
    expect(blank.ok).toBe(true);
    if (!named.ok || !blank.ok) {
      return;
    }

    expect(named.salesOrder.label).toBe("Spring reorder");
    expect(blank.salesOrder.label).toBeUndefined();
    const reloaded = await h.uow.salesOrders.findById(DEFAULT_ORG, named.salesOrder.id);
    expect(reloaded?.label).toBe("Spring reorder");
  });

  it("replace-lines renames, keeps, or clears the label as asked", async () => {
    const h = salesDemandHarness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      wholesaleUserId: WHOLESALE_USER_ID,
      customerId: CUSTOMER_ID,
      label: "Halloween",
      lines: [{ productId: OPEN_PRODUCT_ID, qty: 1 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const base = {
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      wholesaleUserId: WHOLESALE_USER_ID,
      salesOrderId: created.salesOrder.id,
      lines: [{ productId: OPEN_PRODUCT_ID, qty: 2 }],
    } as const;

    const kept = await h.replaceLines.execute(base);
    expect(kept.ok && kept.salesOrder.label).toBe("Halloween");

    const renamed = await h.replaceLines.execute({ ...base, label: "Halloween 2026" });
    expect(renamed.ok && renamed.salesOrder.label).toBe("Halloween 2026");

    const cleared = await h.replaceLines.execute({ ...base, label: null });
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) {
      return;
    }
    expect(cleared.salesOrder.label).toBeUndefined();
    const reloaded = await h.uow.salesOrders.findById(DEFAULT_ORG, created.salesOrder.id);
    expect(reloaded?.label).toBeUndefined();
    expect(reloaded?.lines[0]?.qty).toBe(2);
  });

  it("empty replace-lines cancels only that draft and leaves the sibling cart open", async () => {
    const h = salesDemandHarness();

    const keep = await h.createWholesaleDraft(OPEN_PRODUCT_ID, 2);
    const drop = await h.createWholesaleDraft(LOCK_PRODUCT_ID, 1);
    expect(keep.ok).toBe(true);
    expect(drop.ok).toBe(true);
    if (!keep.ok || !drop.ok) {
      return;
    }

    const replaced = await h.replaceLines.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      wholesaleUserId: WHOLESALE_USER_ID,
      salesOrderId: drop.salesOrderId,
      lines: [],
    });
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) {
      return;
    }
    expect(replaced.salesOrder.status).toBe("cancelled");
    expect(replaced.salesOrder.lines).toHaveLength(0);

    const remaining = openDraftsForCustomer(h);
    expect(remaining.map((row) => row.order.id)).toEqual([keep.salesOrderId]);
  });

  it("replace-lines merges duplicate SKUs in the request", async () => {
    const h = salesDemandHarness();

    const created = await h.createWholesaleDraft(OPEN_PRODUCT_ID, 1);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const replaced = await h.replaceLines.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      wholesaleUserId: WHOLESALE_USER_ID,
      salesOrderId: created.salesOrderId,
      lines: [
        { productId: OPEN_PRODUCT_ID, qty: 2 },
        { productId: OPEN_PRODUCT_ID, qty: 3 },
        { productId: LOCK_PRODUCT_ID, qty: 1 },
      ],
    });
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) {
      return;
    }
    expect(replaced.salesOrder.lines).toHaveLength(2);
    expect(
      replaced.salesOrder.lines.find((line) => line.sku.value === "SALES-OPEN-1")?.qty,
    ).toBe(5);
    expect(
      replaced.salesOrder.lines.find((line) => line.sku.value === "SALES-LOCK-1")?.qty,
    ).toBe(1);
  });

  it("keeps leftover line ids when a draft line is dropped or decreased", async () => {
    const h = salesDemandHarness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      wholesaleUserId: WHOLESALE_USER_ID,
      customerId: CUSTOMER_ID,
      lines: [
        { productId: OPEN_PRODUCT_ID, qty: 4 },
        { productId: LOCK_PRODUCT_ID, qty: 2 },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const openLineId = created.salesOrder.lines.find((line) => line.sku.value === "SALES-OPEN-1")
      ?.id;
    expect(openLineId).toBeDefined();

    const dropped = await h.replaceLines.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      wholesaleUserId: WHOLESALE_USER_ID,
      salesOrderId: created.salesOrder.id,
      lines: [{ productId: OPEN_PRODUCT_ID, qty: 4 }],
    });
    expect(dropped.ok).toBe(true);
    if (!dropped.ok) {
      return;
    }
    expect(dropped.salesOrder.lines).toHaveLength(1);
    expect(dropped.salesOrder.lines[0]?.id).toBe(openLineId);

    const decreased = await h.replaceLines.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      wholesaleUserId: WHOLESALE_USER_ID,
      salesOrderId: created.salesOrder.id,
      lines: [{ productId: OPEN_PRODUCT_ID, qty: 1 }],
    });
    expect(decreased.ok).toBe(true);
    if (!decreased.ok) {
      return;
    }
    expect(decreased.salesOrder.lines[0]?.id).toBe(openLineId);
    expect(decreased.salesOrder.lines[0]?.qty).toBe(1);
  });

  it("does not load catalog qty when every remaining line is the same qty or less", async () => {
    const h = salesDemandHarness();
    const created = await h.create.execute({
      organizationId: DEFAULT_ORG,
      wholesaleUserId: WHOLESALE_USER_ID,
      customerId: CUSTOMER_ID,
      lines: [
        { productId: OPEN_PRODUCT_ID, qty: 4 },
        { productId: LOCK_PRODUCT_ID, qty: 2 },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    let qtyLoads = 0;
    const catalog = {
      findById: h.catalog.findById.bind(h.catalog),
      findBySku: h.catalog.findBySku.bind(h.catalog),
      findByIds: async (
        organizationId: typeof DEFAULT_ORG,
        productIds: Parameters<typeof h.catalog.findByIds>[1],
        options?: Parameters<typeof h.catalog.findByIds>[2],
      ) => {
        if (options?.includeQty !== false) {
          qtyLoads += 1;
        }
        return h.catalog.findByIds(organizationId, productIds, options);
      },
    };
    const replace = new ReplaceSalesOrderLinesUseCase(
      h.uow.salesOrders,
      {
        findById: async (organizationId, id) => {
          if (organizationId !== DEFAULT_ORG || id !== CUSTOMER_ID) {
            return null;
          }
          return { id, accountStatus: "active" as const };
        },
      },
      catalog,
    );

    const dropped = await replace.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      wholesaleUserId: WHOLESALE_USER_ID,
      salesOrderId: created.salesOrder.id,
      lines: [{ productId: OPEN_PRODUCT_ID, qty: 4 }],
    });
    expect(dropped.ok).toBe(true);
    expect(qtyLoads).toBe(0);
  });
});
