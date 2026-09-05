import { describe, expect, it } from "vitest";
import { salesCustomerCell } from "./sales-customer-cell";

describe("salesCustomerCell", () => {
  it("links to the customer when a name is present", () => {
    expect(
      salesCustomerCell({
        customerId: "00000000-0000-0000-0000-000000000001",
        customerName: "Acme Wholesale",
      }),
    ).toEqual({
      kind: "link",
      href: "/customers/00000000-0000-0000-0000-000000000001",
      label: "Acme Wholesale",
    });
  });

  it('links as "Unknown customer" when the id is present but the name is absent', () => {
    expect(
      salesCustomerCell({
        customerId: "00000000-0000-0000-0000-000000000002",
      }),
    ).toEqual({
      kind: "link",
      href: "/customers/00000000-0000-0000-0000-000000000002",
      label: "Unknown customer",
    });
  });

  it("renders an em dash when the customer id is absent", () => {
    expect(salesCustomerCell({ customerName: "Orphaned name" })).toEqual({
      kind: "dash",
    });
    expect(salesCustomerCell({})).toEqual({ kind: "dash" });
  });
});
