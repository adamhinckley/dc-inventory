import {
  CustomerId,
  OrderId,
  OrganizationId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { InMemoryAccountingUnitOfWork } from "../src/adapters/in-memory-accounting-unit-of-work.js";
import { CreateInvoiceUseCase } from "../src/application/create-invoice.js";
import type { ICustomerBillToSnapshotReadPort } from "../src/domain/ports/customer-bill-to-snapshot-read.js";
import type { ICustomerTermsReadPort } from "../src/domain/ports/customer-terms-read.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const ORDER_ID = OrderId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
const DEFAULT_ORG = OrganizationId.DEFAULT;
const POSTED_AT = new Date("2021-06-15T12:00:00.000Z");
const DUE_DATE = new Date("2021-07-15T12:00:00.000Z");

const BILL_TO = {
  line1: "500 Invoice Ave",
  line2: "Suite 2",
  city: "Salt Lake City",
  region: "UT",
  postal: "84101",
  country: "US",
};

function snapshotPorts(
  billTo: typeof BILL_TO | null,
  terms: string | null,
): {
  billToSnapshot: ICustomerBillToSnapshotReadPort;
  customerTerms: ICustomerTermsReadPort;
} {
  return {
    billToSnapshot: {
      getBillToAddressSnapshot: async (organizationId, customerId) => {
        if (organizationId !== DEFAULT_ORG || customerId !== CUSTOMER_ID || billTo === null) {
          return null;
        }
        return billTo;
      },
    },
    customerTerms: {
      getTerms: async (organizationId, customerId) => {
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
    const ports = snapshotPorts(BILL_TO, "Net 30");
    const create = new CreateInvoiceUseCase(
      uow,
      clock,
      ports.billToSnapshot,
      ports.customerTerms,
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
      billLine1: BILL_TO.line1,
      billLine2: BILL_TO.line2,
      billCity: BILL_TO.city,
      billRegion: BILL_TO.region,
      billPostal: BILL_TO.postal,
      billCountry: BILL_TO.country,
      terms: "Net 30",
    });
    expect(result.invoice.dueDate?.getTime()).toBe(DUE_DATE.getTime());
    expect(result.invoice.postedAt?.getTime()).toBe(POSTED_AT.getTime());

    const reloaded = await uow.invoices.findByOrderId(DEFAULT_ORG, ORDER_ID);
    expect(reloaded).toMatchObject({
      billLine1: BILL_TO.line1,
      billLine2: BILL_TO.line2,
      billCity: BILL_TO.city,
      billRegion: BILL_TO.region,
      billPostal: BILL_TO.postal,
      billCountry: BILL_TO.country,
      terms: "Net 30",
    });
    expect(reloaded?.dueDate?.getTime()).toBe(DUE_DATE.getTime());
  });

  it("refuses invoice post when bill-to snapshot port returns null", async () => {
    const uow = new InMemoryAccountingUnitOfWork();
    const ports = snapshotPorts(null, "Net 30");
    const create = new CreateInvoiceUseCase(
      uow,
      new InMemoryClock(POSTED_AT),
      ports.billToSnapshot,
      ports.customerTerms,
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
});
