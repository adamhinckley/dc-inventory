import { describe, expect, it } from "vitest";
import {
  ACCOUNTING_BALANCES_PATH,
  ACCOUNTING_PAYMENTS_PATH,
  accountingBalancesInitialParams,
  accountingPaymentsInitialParams,
  applyAccountingSharedPatch,
} from "../lib/accounting-url-params";

describe("accounting list table seed from shared URL patches", () => {
  it("balances list seeds as-of and bucket from shared patch", () => {
    const urlRecord = applyAccountingSharedPatch(
      {},
      { asOf: "2026-07-01", bucket: "31-45" },
      ACCOUNTING_BALANCES_PATH,
    );

    expect(accountingBalancesInitialParams(urlRecord)).toEqual({
      asOf: "2026-07-01",
      bucket: "31-45",
    });
  });

  it("payments list seeds custom range dates from shared patch", () => {
    const urlRecord = applyAccountingSharedPatch(
      { asOf: "2026-09-08" },
      {
        range: "custom",
        from: "2026-09-01",
        to: "2026-09-08",
      },
      ACCOUNTING_PAYMENTS_PATH,
    );

    expect(accountingPaymentsInitialParams(urlRecord)).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-08",
    });
  });

  it("payments list seeds mtd from/to when range is cleared", () => {
    const urlRecord = applyAccountingSharedPatch(
      {
        asOf: "2026-09-08",
        range: "custom",
        from: "2026-09-01",
        to: "2026-09-08",
      },
      { range: null },
      ACCOUNTING_PAYMENTS_PATH,
    );

    expect(accountingPaymentsInitialParams(urlRecord)).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-08",
    });
  });
});
