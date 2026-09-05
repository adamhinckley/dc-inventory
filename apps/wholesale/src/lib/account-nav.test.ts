import { describe, expect, it } from "vitest";
import {
  exemptionCertificateFilename,
  isExemptionCertificateExpired,
  signedInNavLinks,
  staffActingAccountDashboardHref,
} from "./account-nav";

describe("signedInNavLinks", () => {
  it("includes Account for buyers", () => {
    expect(signedInNavLinks("buyer")).toEqual([
      { href: "/products", label: "Products" },
      { href: "/orders", label: "Orders" },
      { href: "/cart", label: "Cart" },
      { href: "/account", label: "Account" },
    ]);
  });

  it("omits Account when staff is acting", () => {
    expect(signedInNavLinks("staff_acting")).toEqual([
      { href: "/products", label: "Products" },
      { href: "/orders", label: "Orders" },
      { href: "/cart", label: "Cart" },
    ]);
  });
});

describe("staffActingAccountDashboardHref", () => {
  it("links to the customer detail when customerId is set", () => {
    expect(
      staffActingAccountDashboardHref(
        "http://localhost:3000",
        "00000000-0000-0000-0000-000000000005",
      ),
    ).toBe("http://localhost:3000/customers/00000000-0000-0000-0000-000000000005");
  });

  it("links to the customer list when customerId is null", () => {
    expect(staffActingAccountDashboardHref("http://localhost:3000/", null)).toBe(
      "http://localhost:3000/customers",
    );
  });

  it("strips a trailing slash from the internal app URL", () => {
    expect(
      staffActingAccountDashboardHref(
        "https://staff.example.com/",
        "00000000-0000-0000-0000-000000000002",
      ),
    ).toBe("https://staff.example.com/customers/00000000-0000-0000-0000-000000000002");
  });
});

describe("isExemptionCertificateExpired", () => {
  it("returns false when expiry is null", () => {
    expect(isExemptionCertificateExpired(null, new Date("2026-01-01T00:00:00Z"))).toBe(
      false,
    );
  });

  it("returns true when expiry is before now", () => {
    expect(
      isExemptionCertificateExpired(
        "2025-12-31T00:00:00Z",
        new Date("2026-01-01T00:00:00Z"),
      ),
    ).toBe(true);
  });

  it("returns false when expiry is on or after now", () => {
    expect(
      isExemptionCertificateExpired(
        "2026-06-01T00:00:00Z",
        new Date("2026-01-01T00:00:00Z"),
      ),
    ).toBe(false);
  });
});

describe("exemptionCertificateFilename", () => {
  it("returns the basename of an object key", () => {
    expect(exemptionCertificateFilename("certs/ut-resale.pdf")).toBe("ut-resale.pdf");
  });

  it("returns null for empty keys", () => {
    expect(exemptionCertificateFilename(null)).toBeNull();
    expect(exemptionCertificateFilename("")).toBeNull();
  });
});
