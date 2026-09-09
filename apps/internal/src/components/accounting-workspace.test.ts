import { describe, expect, it } from "vitest";
import { accountingTabHref } from "./accounting-workspace";

describe("accountingTabHref re-export", () => {
  it("is wired from accounting-url-params", () => {
    expect(accountingTabHref("/accounting/payments", "bucket=1-15")).toBe(
      "/accounting/payments?bucket=1-15",
    );
  });
});
