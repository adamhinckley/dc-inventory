import { describe, expect, it } from "vitest";
import {
  CUSTOMER_ID,
  DEFAULT_ORG,
  LOCK_PRODUCT_ID,
  OPEN_PRODUCT_ID,
  salesDemandHarness,
  WHOLESALE_USER_ID,
} from "./support/sales-demand-harness.js";

describe("cart draft sales order (ADA-289)", () => {
  it("find-or-create returns the existing wholesale draft on second create", async () => {
    const h = salesDemandHarness();

    const first = await h.createWholesaleDraft(OPEN_PRODUCT_ID, 1);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const second = await h.createWholesaleDraft(OPEN_PRODUCT_ID, 2);
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }

    expect(second.salesOrderId).toBe(first.salesOrderId);
    const reloaded = await h.uow.salesOrders.findById(DEFAULT_ORG, first.salesOrderId);
    expect(reloaded?.status).toBe("draft");
    expect(reloaded?.lines).toHaveLength(1);
    expect(reloaded?.lines[0]?.qty).toBe(3);
  });

  it("find-or-create returns the existing staff-acting draft on second create", async () => {
    const h = salesDemandHarness();

    const first = await h.createStaffActingDraft(OPEN_PRODUCT_ID, 1);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const second = await h.createStaffActingDraft(LOCK_PRODUCT_ID, 1);
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }

    expect(second.salesOrderId).toBe(first.salesOrderId);
    const reloaded = await h.uow.salesOrders.findById(DEFAULT_ORG, first.salesOrderId);
    expect(reloaded?.lines).toHaveLength(2);
  });

  it("find-or-create returns the existing internal draft on second create", async () => {
    const h = salesDemandHarness();

    const first = await h.createStaffDraft(OPEN_PRODUCT_ID, 2);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const second = await h.createStaffDraft(OPEN_PRODUCT_ID, 1);
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }

    expect(second.salesOrderId).toBe(first.salesOrderId);
    const reloaded = await h.uow.salesOrders.findById(DEFAULT_ORG, first.salesOrderId);
    expect(reloaded?.lines[0]?.qty).toBe(3);
  });

  it("empty replace-lines cancels the draft instead of leaving an empty order", async () => {
    const h = salesDemandHarness();

    const created = await h.createWholesaleDraft(OPEN_PRODUCT_ID, 2);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const replaced = await h.replaceLines.execute({
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      wholesaleUserId: WHOLESALE_USER_ID,
      salesOrderId: created.salesOrderId,
      lines: [],
    });
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) {
      return;
    }
    expect(replaced.salesOrder.status).toBe("cancelled");
    expect(replaced.salesOrder.lines).toHaveLength(0);

    const draft = await h.uow.salesOrders.findDraftByCustomer(DEFAULT_ORG, CUSTOMER_ID);
    expect(draft).toBeNull();
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

  it("concurrent find-or-create merges into one draft", async () => {
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

    expect(first.salesOrder.id).toBe(second.salesOrder.id);
    const reloaded = await h.uow.salesOrders.findDraftByCustomer(DEFAULT_ORG, CUSTOMER_ID);
    expect(reloaded?.lines).toHaveLength(1);
    expect(reloaded?.lines[0]?.qty).toBe(5);

    const drafts = [...h.uow.salesOrders.snapshot().byId.values()].filter(
      (row) =>
        row.order.organizationId === DEFAULT_ORG &&
        row.order.customerId === CUSTOMER_ID &&
        row.order.status === "draft",
    );
    expect(drafts).toHaveLength(1);
  });
});
