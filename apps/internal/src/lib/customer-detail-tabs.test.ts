import { describe, expect, it } from "vitest";
import {
  CUSTOMER_DETAIL_TAB_KEYS,
  CUSTOMER_DETAIL_TAB_LABELS,
  customerDetailTabFromSearchParams,
  customerDetailTabHref,
  DEFAULT_CUSTOMER_DETAIL_TAB,
} from "./customer-detail-tabs";

describe("customer detail tabs", () => {
  it("defines the six tab query keys", () => {
    expect(CUSTOMER_DETAIL_TAB_KEYS).toEqual([
      "ship-tos",
      "bill-to",
      "contacts",
      "certificates",
      "orders",
      "accounting",
    ]);
  });

  it("builds hrefs with the tab query key", () => {
    for (const tab of CUSTOMER_DETAIL_TAB_KEYS) {
      expect(customerDetailTabHref("cust-1", tab)).toBe(
        `/customers/cust-1?tab=${tab}`,
      );
    }
  });

  it("labels every tab for RouterTabs triggers", () => {
    for (const tab of CUSTOMER_DETAIL_TAB_KEYS) {
      expect(CUSTOMER_DETAIL_TAB_LABELS[tab].length).toBeGreaterThan(0);
    }
  });

  it("defaults to ship-tos when tab is missing or unknown", () => {
    expect(customerDetailTabFromSearchParams({})).toBe(DEFAULT_CUSTOMER_DETAIL_TAB);
    expect(customerDetailTabFromSearchParams({ tab: "unknown" })).toBe(
      DEFAULT_CUSTOMER_DETAIL_TAB,
    );
    expect(customerDetailTabFromSearchParams({ tab: "bill-to" })).toBe("bill-to");
  });
});
