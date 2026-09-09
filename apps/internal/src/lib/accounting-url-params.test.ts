import { describe, expect, it } from "vitest";
import {
  accountingAsOfFromSearchParams,
  accountingBalancesInitialParams,
  accountingPaymentDateRange,
  accountingPaymentsInitialParams,
  accountingPaymentRangeFromSearchParams,
  accountingTabHref,
  formatPastDuePercentLabel,
  monthStartIsoDate,
} from "./accounting-url-params";

describe("accountingTabHref", () => {
  it("carries the current query onto the sibling tab", () => {
    expect(
      accountingTabHref("/accounting/payments", "asOf=2026-08-01&range=mtd"),
    ).toBe("/accounting/payments?asOf=2026-08-01&range=mtd");
  });

  it("stays a bare path when the query is empty", () => {
    expect(accountingTabHref("/accounting", "")).toBe("/accounting");
  });
});

describe("accountingPaymentDateRange", () => {
  it("uses the as-of day for Today", () => {
    expect(
      accountingPaymentDateRange("2026-09-08", "today", {}),
    ).toEqual({ from: "2026-09-08", to: "2026-09-08" });
  });

  it("uses month start through as-of for MTD", () => {
    expect(accountingPaymentDateRange("2026-09-08", "mtd", {})).toEqual({
      from: "2026-09-01",
      to: "2026-09-08",
    });
  });

  it("reads custom from/to from the URL", () => {
    expect(
      accountingPaymentDateRange("2026-09-08", "custom", {
        from: "2026-08-15",
        to: "2026-08-31",
      }),
    ).toEqual({ from: "2026-08-15", to: "2026-08-31" });
  });
});

describe("accounting initial params", () => {
  it("defaults asOf to today for balances", () => {
    const params = accountingBalancesInitialParams({});
    expect(params.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("passes bucket and asOf through for balances", () => {
    expect(
      accountingBalancesInitialParams({
        asOf: "2026-08-01",
        bucket: "31-45",
        sortBy: "pastDueCents",
        sortOrder: "desc",
      }),
    ).toEqual({
      asOf: "2026-08-01",
      bucket: "31-45",
      sortBy: "pastDueCents",
      sortOrder: "desc",
    });
  });

  it("defaults payment range to mtd", () => {
    expect(accountingPaymentRangeFromSearchParams({})).toBe("mtd");
  });

  it("derives payment list from/to for mtd", () => {
    expect(
      accountingPaymentsInitialParams({ asOf: "2026-09-08", range: "mtd" }),
    ).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-08",
    });
  });
});

describe("monthStartIsoDate", () => {
  it("returns the first day of the month", () => {
    expect(monthStartIsoDate("2026-09-08")).toBe("2026-09-01");
  });
});

describe("formatPastDuePercentLabel", () => {
  it("formats server percent for the KPI tile", () => {
    expect(formatPastDuePercentLabel(42)).toBe("42% of open AR");
  });
});

describe("accountingAsOfFromSearchParams", () => {
  it("reads asOf from the query string", () => {
    expect(accountingAsOfFromSearchParams({ asOf: "2026-07-15" })).toBe(
      "2026-07-15",
    );
  });
});
