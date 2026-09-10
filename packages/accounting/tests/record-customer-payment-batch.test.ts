import {
  CustomerId,
  InvoiceId,
  Money,
  OrderId,
  OrganizationId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryAccountingUnitOfWork } from "../src/adapters/in-memory-accounting-unit-of-work.js";
import type { IAccountingRepository } from "../src/domain/ports/invoice-repository.js";
import { RecordCustomerPaymentUseCase } from "../src/application/record-customer-payment.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const DEFAULT_ORG = OrganizationId.DEFAULT;

function countingRepository(base: IAccountingRepository): {
  repo: IAccountingRepository;
  getCallCount: () => number;
  resetCallCount: () => void;
} {
  const state = { calls: 0 };
  const repo = new Proxy(base, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") {
        return value;
      }
      return (...args: unknown[]) => {
        state.calls += 1;
        return (value as (...inner: unknown[]) => unknown).apply(target, args);
      };
    },
  }) as IAccountingRepository;
  return {
    repo,
    getCallCount: () => state.calls,
    resetCallCount: () => {
      state.calls = 0;
    },
  };
}

async function seedPostedInvoice(
  repo: IAccountingRepository,
  input: { id: string; orderId: string; totalCents: number },
) {
  const zero = Money.fromMinorUnits(0, "USD");
  const total = Money.fromMinorUnits(input.totalCents, "USD");
  await repo.save({
    id: InvoiceId.parse(input.id),
    organizationId: DEFAULT_ORG,
    orderId: OrderId.parse(input.orderId),
    customerId: CUSTOMER_ID,
    documentNumber: `INV-${input.id.slice(0, 4)}`,
    status: "posted",
    postedAt: new Date("2026-01-01T00:00:00.000Z"),
    billLine1: null,
    billLine2: null,
    billCity: null,
    billRegion: null,
    billPostal: null,
    billCountry: null,
    dueDate: new Date("2026-07-31T00:00:00.000Z"),
    terms: "Net 30",
    subtotal: total,
    taxTotal: zero,
    total,
  });
  return InvoiceId.parse(input.id);
}

describe("RecordCustomerPaymentUseCase batch reads", () => {
  it("records a payment across ten invoices", async () => {
    const uow = new InMemoryAccountingUnitOfWork();
    const useCase = new RecordCustomerPaymentUseCase(uow);
    const applications = await Promise.all(
      Array.from({ length: 10 }, async (_, index) => {
        const suffix = String(index + 1).padStart(2, "0");
        const invoiceId = await seedPostedInvoice(uow.invoices, {
          id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa${suffix}`,
          orderId: `cccccccc-cccc-4ccc-8ccc-cccccccccc${suffix}`,
          totalCents: 10_000 + index,
        });
        return { invoiceId, amountCents: 1_000 };
      }),
    );
    const result = await useCase.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 10_000,
      currency: "USD",
      method: "check",
      idempotencyKey: "batch-ten-apps-smoke",
      holdRemainderAsCredit: false,
      applications,
    });
    if (!result.ok) {
      throw new Error(`expected ok payment, got ${result.reason}`);
    }
  });

  it("uses at most 15 repository calls for 10 applications in one transaction", async () => {
    const base = new InMemoryAccountingUnitOfWork().invoices;
    const { repo: invoices, getCallCount, resetCallCount } = countingRepository(base);
    const uow = new InMemoryAccountingUnitOfWork(invoices);
    const useCase = new RecordCustomerPaymentUseCase(uow);

    const applications = await Promise.all(
      Array.from({ length: 10 }, async (_, index) => {
        const suffix = String(index + 1).padStart(2, "0");
        const invoiceId = await seedPostedInvoice(invoices, {
          id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa${suffix}`,
          orderId: `cccccccc-cccc-4ccc-8ccc-cccccccccc${suffix}`,
          totalCents: 10_000 + index,
        });
        return { invoiceId, amountCents: 1_000 };
      }),
    );
    resetCallCount();

    const result = await useCase.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      customerId: CUSTOMER_ID,
      amountCents: 10_000,
      currency: "USD",
      method: "check",
      idempotencyKey: "batch-ten-apps",
      holdRemainderAsCredit: false,
      applications,
    });

    if (!result.ok) {
      throw new Error(`expected ok payment, got ${result.reason}`);
    }
    expect(getCallCount()).toBeLessThanOrEqual(15);
  });
});
