import { describe, expect, it } from "vitest";
import {
  allocationRemainderCents,
  allocationsExceedInvoiceRemaining,
  prefillAllocationsOldestFirst,
  recordPaymentSubmitDisabled,
  sortInvoicesOldestDueFirst,
  sumAllocations,
} from "./customer-accounting-allocation";

describe("customer accounting allocation", () => {
  const invoices = [
    {
      id: "newer",
      documentNumber: "INV-00512",
      remainingCents: 2_400_00,
      dueDate: "2026-09-18",
      postedAt: "2026-08-19",
    },
    {
      id: "oldest",
      documentNumber: "INV-00412",
      remainingCents: 45_50,
      dueDate: "2026-06-27",
      postedAt: "2026-05-28",
    },
    {
      id: "middle",
      documentNumber: "INV-00489",
      remainingCents: 1_100_00,
      dueDate: "2026-08-29",
      postedAt: "2026-07-30",
    },
  ];

  it("sorts open invoices oldest due date first", () => {
    expect(sortInvoicesOldestDueFirst(invoices).map((row) => row.id)).toEqual([
      "oldest",
      "middle",
      "newer",
    ]);
  });

  it("prefills allocations oldest-due-first up to the payment amount", () => {
    expect(prefillAllocationsOldestFirst(5_000_00, invoices)).toEqual({
      oldest: 45_50,
      middle: 1_100_00,
      newer: 2_400_00,
    });
  });

  it("computes remaining to allocate from amount minus applied cents", () => {
    expect(
      allocationRemainderCents({
        amountCents: 5_000_00,
        allocatedCents: 3_545_50,
        holdRemainderAsCredit: false,
      }),
    ).toBe(1_454_50);
  });

  it("keeps submit disabled until apply plus held credit equals the amount", () => {
    const partial = {
      amountCents: 5_000_00,
      allocatedCents: 3_545_50,
      holdRemainderAsCredit: false,
    };
    expect(recordPaymentSubmitDisabled(partial)).toBe(true);

    expect(
      recordPaymentSubmitDisabled({
        ...partial,
        holdRemainderAsCredit: true,
      }),
    ).toBe(false);

    expect(
      recordPaymentSubmitDisabled({
        amountCents: 5_000_00,
        allocatedCents: 5_000_00,
        holdRemainderAsCredit: false,
      }),
    ).toBe(false);
  });

  it("blocks submit when applied exceeds the payment amount", () => {
    expect(
      recordPaymentSubmitDisabled({
        amountCents: 1_000_00,
        allocatedCents: 1_200_00,
        holdRemainderAsCredit: true,
      }),
    ).toBe(true);
    expect(
      sumAllocations({
        a: 700_00,
        b: 300_00,
      }),
    ).toBe(1_000_00);
  });

  it("blocks submit when any apply cell exceeds that invoice remaining", () => {
    expect(
      allocationsExceedInvoiceRemaining(
        { oldest: 45_50, middle: 50_00 },
        invoices,
      ),
    ).toBe(false);
    expect(
      allocationsExceedInvoiceRemaining(
        { oldest: 45_50, middle: 2_000_00 },
        invoices,
      ),
    ).toBe(true);
    expect(
      recordPaymentSubmitDisabled({
        amountCents: 3_545_50,
        allocatedCents: 3_545_50,
        holdRemainderAsCredit: false,
        allocations: { oldest: 45_50, middle: 2_000_00, newer: 1_500_00 },
        invoices,
      }),
    ).toBe(true);
  });
});
