import { describe, expect, it } from "vitest";
import {
  paymentDetailFromAccountingPayment,
  paymentDetailFromCustomerPayment,
  paymentDetailText,
  paymentDetailToCustomerRow,
} from "./payment-detail";
import type { AccountingPaymentRow } from "./accounting-types";
import type { CustomerPaymentRow } from "./customer-accounting-types";

const customerPayment = {
  id: "11111111-1111-4111-8111-111111111111",
  amountCents: 2500,
  currency: "USD",
  method: "check",
  reference: "4411",
  note: "front desk check",
  receivedAt: "2026-09-08T00:00:00.000Z",
  appliedCents: 2500,
  unappliedCents: 0,
  voided: true,
  voidReason: "duplicate deposit",
  applications: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      invoiceId: "33333333-3333-4333-8333-333333333333",
      amountCents: 2500,
      currency: "USD",
      createdAt: "2026-09-08T00:00:00.000Z",
    },
  ],
} satisfies CustomerPaymentRow;

const accountingPayment = {
  paymentId: "11111111-1111-4111-8111-111111111111",
  receivedAt: "2026-09-08T00:00:00.000Z",
  customerId: "44444444-4444-4444-8444-444444444444",
  customerNumber: "100001",
  customerName: "AR Customer",
  amountCents: 2500,
  currency: "USD",
  method: "check",
  reference: "4411",
  note: "front desk check",
  voidReason: "duplicate deposit",
  appliedCents: 2500,
  unappliedCents: 0,
  voided: true,
  applications: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      invoiceId: "33333333-3333-4333-8333-333333333333",
      amountCents: 2500,
      currency: "USD",
      createdAt: "2026-09-08T00:00:00.000Z",
    },
  ],
} satisfies AccountingPaymentRow;

describe("payment detail mapping", () => {
  it("keeps note, void reason, and applications from both list rows", () => {
    const fromCustomer = paymentDetailFromCustomerPayment(
      customerPayment,
      "44444444-4444-4444-8444-444444444444",
    );
    const fromOrg = paymentDetailFromAccountingPayment(accountingPayment);

    expect(fromCustomer.note).toBe("front desk check");
    expect(fromCustomer.voidReason).toBe("duplicate deposit");
    expect(fromCustomer.applications[0]?.invoiceId).toBe(
      "33333333-3333-4333-8333-333333333333",
    );
    expect(fromOrg).toEqual(fromCustomer);
    expect(paymentDetailToCustomerRow(fromOrg).id).toBe(accountingPayment.paymentId);
  });

  it("renders blank note and void reason as an em dash", () => {
    expect(paymentDetailText(null)).toBe("—");
    expect(paymentDetailText("  ")).toBe("—");
    expect(paymentDetailText("keep this")).toBe("keep this");
  });
});
