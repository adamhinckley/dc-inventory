import {
  CustomerId,
  OrderId,
  OrganizationId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { CreateInvoiceForOrderAdapter } from "../src/adapters/create-invoice-for-order-adapter.js";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { InMemoryAccountingUnitOfWork } from "../src/adapters/in-memory-accounting-unit-of-work.js";
import { InMemoryInvoiceRepository } from "../src/adapters/in-memory-invoice-repository.js";
import { CreateInvoiceUseCase } from "../src/application/create-invoice.js";
import {
  TEST_BILL_TO,
  testInvoiceSnapshotPorts,
} from "./support/invoice-snapshot-port-fixtures.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const ORDER_ID = OrderId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
const DEFAULT_ORG = OrganizationId.DEFAULT;
const POSTED_AT = new Date("2021-06-15T12:00:00.000Z");
const DUE_DATE = new Date("2021-07-15T12:00:00.000Z");

function scopedSnapshotPorts(billTo: typeof TEST_BILL_TO | null, terms: string | null) {
  return {
    billToSnapshot: {
      getBillToAddressSnapshot: async (organizationId: OrganizationId, customerId: CustomerId) => {
        if (organizationId !== DEFAULT_ORG || customerId !== CUSTOMER_ID || billTo === null) {
          return null;
        }
        return billTo;
      },
    },
    customerTerms: {
      getTerms: async (organizationId: OrganizationId, customerId: CustomerId) => {
        if (organizationId !== DEFAULT_ORG || customerId !== CUSTOMER_ID) {
          return null;
        }
        return terms;
      },
    },
  };
}

describe("Accounting invoice bill-to snapshot at ship (ADA-262, U8)", () => {
  it("posts invoice with six frozen bill-to fields and copied terms/due date from customer", async () => {
    const clock = new InMemoryClock(POSTED_AT);
    const uow = new InMemoryAccountingUnitOfWork();
    const ports = scopedSnapshotPorts(TEST_BILL_TO, "Net 30");
    const create = new CreateInvoiceUseCase(
      uow,
      ports.billToSnapshot,
      ports.customerTerms,
      clock,
    );

    const result = await create.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      orderId: ORDER_ID,
      customerId: CUSTOMER_ID,
      subtotalCents: 1500,
      currency: "USD",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.created).toBe(true);
    expect(result.invoice).toMatchObject({
      billLine1: TEST_BILL_TO.line1,
      billLine2: TEST_BILL_TO.line2,
      billCity: TEST_BILL_TO.city,
      billRegion: TEST_BILL_TO.region,
      billPostal: TEST_BILL_TO.postal,
      billCountry: TEST_BILL_TO.country,
      terms: "Net 30",
    });
    expect(result.invoice.dueDate?.getTime()).toBe(DUE_DATE.getTime());
    expect(result.invoice.postedAt?.getTime()).toBe(POSTED_AT.getTime());

    const reloaded = await uow.invoices.findByOrderId(DEFAULT_ORG, ORDER_ID);
    expect(reloaded).toMatchObject({
      billLine1: TEST_BILL_TO.line1,
      billLine2: TEST_BILL_TO.line2,
      billCity: TEST_BILL_TO.city,
      billRegion: TEST_BILL_TO.region,
      billPostal: TEST_BILL_TO.postal,
      billCountry: TEST_BILL_TO.country,
      terms: "Net 30",
    });
    expect(reloaded?.dueDate?.getTime()).toBe(DUE_DATE.getTime());
  });

  it("refuses invoice post when bill-to snapshot port returns null", async () => {
    const uow = new InMemoryAccountingUnitOfWork();
    const ports = scopedSnapshotPorts(null, "Net 30");
    const create = new CreateInvoiceUseCase(
      uow,
      ports.billToSnapshot,
      ports.customerTerms,
      new InMemoryClock(POSTED_AT),
    );

    const result = await create.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      orderId: ORDER_ID,
      customerId: CUSTOMER_ID,
      subtotalCents: 500,
      currency: "USD",
    });

    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(await uow.invoices.findByOrderId(DEFAULT_ORG, ORDER_ID)).toBeNull();
  });

  it("refuses invoice post when customer terms are not Net-N parseable", async () => {
    const uow = new InMemoryAccountingUnitOfWork();
    const ports = scopedSnapshotPorts(TEST_BILL_TO, "Due on receipt");
    const create = new CreateInvoiceUseCase(
      uow,
      ports.billToSnapshot,
      ports.customerTerms,
      new InMemoryClock(POSTED_AT),
    );

    const result = await create.execute({
      staffUserId: STAFF_ID,
      organizationId: DEFAULT_ORG,
      orderId: ORDER_ID,
      customerId: CUSTOMER_ID,
      subtotalCents: 500,
      currency: "USD",
    });

    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(await uow.invoices.findByOrderId(DEFAULT_ORG, ORDER_ID)).toBeNull();
  });

  it("createInvoiceForOrder copies bill-to snapshot (ship accounting hook path)", async () => {
    const clock = new InMemoryClock(POSTED_AT);
    const invoices = new InMemoryInvoiceRepository();
    const ports = scopedSnapshotPorts(TEST_BILL_TO, "Net 30");
    const createForOrder = new CreateInvoiceForOrderAdapter(
      invoices,
      ports.billToSnapshot,
      ports.customerTerms,
      clock,
    );

    const result = await createForOrder.createInvoiceForOrder({
      organizationId: DEFAULT_ORG,
      orderId: ORDER_ID,
      customerId: CUSTOMER_ID,
      subtotalCents: 1200,
      currency: "USD",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const invoice = await invoices.findByOrderId(DEFAULT_ORG, ORDER_ID);
    expect(invoice).toMatchObject({
      billLine1: TEST_BILL_TO.line1,
      billLine2: TEST_BILL_TO.line2,
      billCity: TEST_BILL_TO.city,
      billRegion: TEST_BILL_TO.region,
      billPostal: TEST_BILL_TO.postal,
      billCountry: TEST_BILL_TO.country,
      terms: "Net 30",
    });
    expect(invoice?.dueDate?.getTime()).toBe(DUE_DATE.getTime());
  });
});
