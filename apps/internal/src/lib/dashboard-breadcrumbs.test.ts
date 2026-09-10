import { describe, expect, it } from "vitest";
import { crumbsFromPathname } from "./dashboard-breadcrumbs";

describe("crumbsFromPathname", () => {
  it("maps a receiving document history path with a document-number label", () => {
    expect(
      crumbsFromPathname("/procurement/receiving/abc/history", { abc: "PO-00016" }),
    ).toEqual([
      { href: "/procurement", label: "Procurement", current: false },
      { href: "/procurement/receiving", label: "Receiving", current: false },
      { href: "/procurement/receiving/abc", label: "PO-00016", current: false },
      { href: "/procurement/receiving/abc/history", label: "History", current: true },
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
      { href: "/inventory/reopen", label: "Sell Windows", current: true },
    ]);
  });

  it("labels procurement hub and pre-order tabs", () => {
    expect(crumbsFromPathname("/procurement")).toEqual([
      { href: "/procurement", label: "Procurement", current: true },
    ]);
    expect(crumbsFromPathname("/procurement/pre-order/factory-1")).toEqual([
      { href: "/procurement", label: "Procurement", current: false },
      { href: "/procurement/pre-order", label: "Pre-order", current: false },
      { href: "/procurement/pre-order/factory-1", label: "factory-1", current: true },
    ]);
  });

  it("labels a procurement purchase order with a document-number label", () => {
    expect(crumbsFromPathname("/procurement/purchase-orders/abc", { abc: "PO-00042" })).toEqual([
      { href: "/procurement", label: "Procurement", current: false },
      { href: "/procurement/purchase-orders", label: "Purchase Orders", current: false },
      { href: "/procurement/purchase-orders/abc", label: "PO-00042", current: true },
    ]);
  });
});
