import { CustomerId, OrderId, StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { InMemoryAccountingUnitOfWork } from "../src/adapters/in-memory-accounting-unit-of-work.js";
import {
  CorrectPaymentUseCase,
  CreateInvoiceUseCase,
  GetInvoiceUseCase,
  RecordPaymentUseCase,
} from "../src/index.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const ORDER_ID = OrderId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
const FIXED = new Date("2021-06-15T12:00:00.000Z");

function harness() {
  const clock = new InMemoryClock(FIXED);
  const uow = new InMemoryAccountingUnitOfWork();
  return {
    clock,
    uow,
    create: new CreateInvoiceUseCase(uow, clock),
    get: new GetInvoiceUseCase(uow.invoices),
    record: new RecordPaymentUseCase(uow, clock),
    correct: new CorrectPaymentUseCase(uow, clock),
  };
}

describe("Accounting seed clock (in-memory)", () => {
  it("posts a zero-tax invoice and applies a payment through existing remainder rules", async () => {
    const h = harness();
    const created = await h.create.execute({
      staffUserId: STAFF_ID,
      orderId: ORDER_ID,
      customerId: CUSTOMER_ID,
      subtotalCents: 1000,
      currency: "USD",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.invoice.documentNumber).toBe("INV-00001");
    expect(created.invoice.taxTotal.amountMinor).toBe(0);
    expect(created.invoice.total.amountMinor).toBe(1000);

    const paid = await h.record.execute({
      staffUserId: STAFF_ID,
      invoiceId: created.invoice.id,
      amountCents: 400,
      currency: "USD",
      idempotencyKey: "clock-pay",
    });
    expect(paid.ok).toBe(true);
    if (!paid.ok) {
      return;
    }
    expect(paid.remainingCents).toBe(600);

    const view = await h.get.execute({
      staffUserId: STAFF_ID,
      invoiceId: created.invoice.id,
    });
    expect(view.ok).toBe(true);
    if (!view.ok) {
      return;
    }
    expect(view.invoice.remainingCents).toBe(600);
    expect(view.invoice.taxTotalCents).toBe(0);
  });

  it.fails("persists the injected posting instant on invoices", async () => {
    const h = harness();
    const created = await h.create.execute({
      staffUserId: STAFF_ID,
      orderId: ORDER_ID,
      customerId: CUSTOMER_ID,
      subtotalCents: 800,
      currency: "USD",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const view = await h.get.execute({
      staffUserId: STAFF_ID,
      invoiceId: created.invoice.id,
    });
    expect(view.ok).toBe(true);
    if (!view.ok) {
      return;
    }
    expect(view.invoice.postedAt?.getTime()).toBe(FIXED.getTime());
  });

  it.fails("persists the injected posting instant on payments", async () => {
    const h = harness();
    const created = await h.create.execute({
      staffUserId: STAFF_ID,
      orderId: ORDER_ID,
      customerId: CUSTOMER_ID,
      subtotalCents: 800,
      currency: "USD",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const paid = await h.record.execute({
      staffUserId: STAFF_ID,
      invoiceId: created.invoice.id,
      amountCents: 800,
      currency: "USD",
      idempotencyKey: "clock-pay-time",
    });
    expect(paid.ok).toBe(true);

    const payment = await h.uow.invoices.findPaymentByIdempotencyKey("clock-pay-time");
    expect(payment?.payment.createdAt.getTime()).toBe(FIXED.getTime());
  });

  it.fails("persists the injected posting instant on payment applications", async () => {
    const h = harness();
    const created = await h.create.execute({
      staffUserId: STAFF_ID,
      orderId: ORDER_ID,
      customerId: CUSTOMER_ID,
      subtotalCents: 800,
      currency: "USD",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const paid = await h.record.execute({
      staffUserId: STAFF_ID,
      invoiceId: created.invoice.id,
      amountCents: 800,
      currency: "USD",
      idempotencyKey: "clock-pay-time",
    });
    expect(paid.ok).toBe(true);

    const applications = await h.uow.invoices.listApplications(created.invoice.id);
    expect(applications).toHaveLength(1);
    expect(applications[0]?.createdAt.getTime()).toBe(FIXED.getTime());
  });

  it.fails("persists the injected posting instant on compensating applications", async () => {
    const h = harness();
    const created = await h.create.execute({
      staffUserId: STAFF_ID,
      orderId: ORDER_ID,
      customerId: CUSTOMER_ID,
      subtotalCents: 800,
      currency: "USD",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const paid = await h.record.execute({
      staffUserId: STAFF_ID,
      invoiceId: created.invoice.id,
      amountCents: 800,
      currency: "USD",
      idempotencyKey: "clock-pay-correct",
    });
    expect(paid.ok).toBe(true);

    const applications = await h.uow.invoices.listApplications(created.invoice.id);
    expect(applications).toHaveLength(1);
    const paymentId = applications[0]!.paymentId;

    const corrected = await h.correct.execute({
      staffUserId: STAFF_ID,
      invoiceId: created.invoice.id,
      paymentId,
      correctionAmountCents: -200,
      currency: "USD",
    });
    expect(corrected.ok).toBe(true);

    const after = await h.uow.invoices.listApplications(created.invoice.id);
    expect(after).toHaveLength(2);
    expect(after[1]?.createdAt.getTime()).toBe(FIXED.getTime());
  });
});
