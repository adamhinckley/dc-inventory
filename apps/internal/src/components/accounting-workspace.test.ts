import { describe, expect, it } from "vitest";
import {
  ACCOUNTING_BALANCES_PATH,
  ACCOUNTING_PAYMENTS_PATH,
  accountingTabHref,
  applyAccountingSharedPatch,
} from "../lib/accounting-url-params";

describe("accounting workspace tab href", () => {
  it("hands off only shared as-of to the payments tab", () => {
    expect(
      accountingTabHref(ACCOUNTING_PAYMENTS_PATH, {
        asOf: "2026-08-01",
        bucket: "16-30",
        q: "al's",
        page: "2",
        sortBy: "pastDueCents",
      }),
    ).toBe("/accounting/payments?asOf=2026-08-01");
  });

  it("drops custom payment range when returning to balances", () => {
    expect(
      accountingTabHref(ACCOUNTING_BALANCES_PATH, {
        asOf: "2026-08-01",
        range: "custom",
        from: "2026-08-01",
        to: "2026-08-20",
        page: "2",
      }),
    ).toBe("/accounting?asOf=2026-08-01");
  });
});

describe("accounting shared controls patch hooks", () => {
  it("changes the as-of param the summary hook receives", () => {
    expect(
      applyAccountingSharedPatch({}, { asOf: "2026-07-01" }, ACCOUNTING_BALANCES_PATH),
    ).toEqual({ asOf: "2026-07-01" });
  });

  it("changes the bucket param the balances list receives", () => {
    expect(
      applyAccountingSharedPatch({}, { bucket: "31-45" }, ACCOUNTING_BALANCES_PATH),
    ).toEqual({ bucket: "31-45" });
  });

  it("changes the range and custom dates the payments list receives", () => {
    expect(
      applyAccountingSharedPatch(
        { asOf: "2026-09-08" },
        {
          range: "custom",
          from: "2026-09-01",
          to: "2026-09-08",
        },
        ACCOUNTING_PAYMENTS_PATH,
      ),
    ).toEqual({
      asOf: "2026-09-08",
      range: "custom",
      from: "2026-09-01",
      to: "2026-09-08",
    });
  });
});
