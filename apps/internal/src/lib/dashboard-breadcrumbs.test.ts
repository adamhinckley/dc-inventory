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
});
