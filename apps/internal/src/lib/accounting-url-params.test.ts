import { describe, expect, it } from "vitest";
import {
  ACCOUNTING_BALANCES_PATH,
  ACCOUNTING_PAYMENTS_PATH,
  accountingAsOfFromSearchParams,
  accountingBalancesInitialParams,
  accountingPaymentDateRange,
  accountingPaymentsInitialParams,
  accountingPaymentRangeFromSearchParams,
  accountingSearchQueryString,
  accountingTabHref,
  accountingUrlParamsForPath,
  applyAccountingSharedPatch,
  applyAccountingTableParams,
  formatPastDuePercentLabel,
  monthStartIsoDate,
} from "./accounting-url-params";
import { listInternalAccountingCustomerBalancesTable } from "@dc-inventory/api-client-internal";

describe("accountingTabHref", () => {
  it("carries as-of onto the sibling tab without balances list keys", () => {
    expect(
      accountingTabHref(ACCOUNTING_PAYMENTS_PATH, {
        asOf: "2026-08-01",
        q: "al's",
        page: "2",
        sortBy: "pastDueCents",
        bucket: "31-45",
      }),
    ).toBe("/accounting/payments?asOf=2026-08-01");
  });

  it("carries as-of and bucket onto balances without payments range keys", () => {
    expect(
      accountingTabHref(ACCOUNTING_BALANCES_PATH, {
        asOf: "2026-08-01",
        range: "custom",
        from: "2026-08-01",
        to: "2026-08-15",
        page: "3",
      }),
    ).toBe("/accounting?asOf=2026-08-01");
  });

  it("stays a bare path when the query is empty", () => {
    expect(accountingTabHref(ACCOUNTING_BALANCES_PATH, {})).toBe(
      ACCOUNTING_BALANCES_PATH,
    );
  });
});

describe("applyAccountingSharedPatch", () => {
  it("writes as-of for summary and table hooks", () => {
    expect(
      applyAccountingSharedPatch({}, { asOf: "2026-07-15" }, ACCOUNTING_BALANCES_PATH),
    ).toEqual({ asOf: "2026-07-15" });
  });

  it("clears bucket when toggled off", () => {
    expect(
      applyAccountingSharedPatch(
        { bucket: "1-15", asOf: "2026-07-15" },
        { bucket: null },
        ACCOUNTING_BALANCES_PATH,
      ),
    ).toEqual({ asOf: "2026-07-15" });
  });

  it("sets custom payment range without leaking balances q", () => {
    expect(
      applyAccountingSharedPatch(
        { q: "flowers", range: "mtd" },
        {
          range: "custom",
          from: "2026-08-01",
          to: "2026-08-15",
        },
        ACCOUNTING_PAYMENTS_PATH,
      ),
    ).toEqual({
      range: "custom",
      from: "2026-08-01",
      to: "2026-08-15",
    });
  });

  it("drops custom from/to when switching to MTD", () => {
    expect(
      applyAccountingSharedPatch(
        {
          range: "custom",
          from: "2026-08-01",
          to: "2026-08-15",
        },
        { range: null },
        ACCOUNTING_PAYMENTS_PATH,
      ),
    ).toEqual({});
  });
});

describe("applyAccountingTableParams", () => {
  it("writes balances table keys without reintroducing payments range", () => {
    expect(
      applyAccountingTableParams(
        {
          range: "custom",
          from: "2026-08-01",
          to: "2026-08-15",
          asOf: "2026-08-01",
        },
        ACCOUNTING_BALANCES_PATH,
        listInternalAccountingCustomerBalancesTable,
        {
          q: "al's",
          sortBy: "pastDueCents",
          sortOrder: "desc",
          asOf: "2026-08-01",
        },
      ),
    ).toMatchObject({
      asOf: "2026-08-01",
      q: "al's",
    });
    expect(
      applyAccountingTableParams(
        {
          range: "custom",
          from: "2026-08-01",
          to: "2026-08-15",
          asOf: "2026-08-01",
        },
        ACCOUNTING_BALANCES_PATH,
        listInternalAccountingCustomerBalancesTable,
        {
          q: "al's",
          sortBy: "pastDueCents",
          sortOrder: "desc",
          asOf: "2026-08-01",
        },
      ).range,
    ).toBeUndefined();
  });
});

describe("accountingUrlParamsForPath", () => {
  it("omits today as-of from the URL", () => {
    expect(
      accountingSearchQueryString(ACCOUNTING_BALANCES_PATH, {}),
    ).toBe("");
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

describe("accountingUrlParamsForPath isolation", () => {
  it("drops sibling-tab keys when building payments params", () => {
    expect(
      accountingUrlParamsForPath(ACCOUNTING_PAYMENTS_PATH, {
        q: "100076",
        bucket: "90+",
        sortBy: "name",
      }),
    ).toEqual({});
  });
});
