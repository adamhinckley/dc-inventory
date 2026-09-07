import { describe, expect, it } from "vitest";
import { crumbsFromPathname } from "./dashboard-breadcrumbs";

describe("crumbsFromPathname", () => {
  it("maps a receiving document history path with a document-number label", () => {
    expect(
      crumbsFromPathname("/receiving/abc/history", { abc: "PO-00016" }),
    ).toEqual([
      { href: "/receiving", label: "Receiving", current: false },
      { href: "/receiving/abc", label: "PO-00016", current: false },
      { href: "/receiving/abc/history", label: "History", current: true },
    ]);
  });

  it("uses nav labels for a section root", () => {
    expect(crumbsFromPathname("/catalog")).toEqual([
      { href: "/catalog", label: "Catalog", current: true },
    ]);
  });

  it("labels the inventory reopen tab", () => {
    expect(crumbsFromPathname("/inventory/reopen")).toEqual([
      { href: "/inventory", label: "Inventory", current: false },
      { href: "/inventory/reopen", label: "Manage Pre-Sell", current: true },
    ]);
  });

  it("labels purchasing 2.0 hub and uncovered tabs", () => {
    expect(crumbsFromPathname("/purchasing-2")).toEqual([
      { href: "/purchasing-2", label: "Purchasing 2.0", current: true },
    ]);
    expect(crumbsFromPathname("/purchasing-2/uncovered")).toEqual([
      { href: "/purchasing-2", label: "Purchasing 2.0", current: false },
      { href: "/purchasing-2/uncovered", label: "Uncovered", current: true },
    ]);
  });

  it("labels a purchasing 2.0 purchase order with a document-number label", () => {
    expect(crumbsFromPathname("/purchasing-2/abc", { abc: "PO-00042" })).toEqual([
      { href: "/purchasing-2", label: "Purchasing 2.0", current: false },
      { href: "/purchasing-2/abc", label: "PO-00042", current: true },
    ]);
  });
});
