import { describe, expect, it } from "vitest";
import { buildUpdateCustomerBody } from "./customer-edit-body";

describe("buildUpdateCustomerBody", () => {
  it("does not send customerNote from staff edit", () => {
    const body = buildUpdateCustomerBody(
      { currency: "USD" },
      {
        name: " Acme Wholesale ",
        terms: " Net 30 ",
        creditLimitCents: 500000,
        taxId: " 12-345 ",
        accountStatus: "active",
        staffNote: " VIP ",
      },
    );

    expect(body).toEqual({
      name: "Acme Wholesale",
      terms: "Net 30",
      creditLimitCents: 500000,
      currency: "USD",
      taxId: "12-345",
      accountStatus: "active",
      staffNote: "VIP",
    });
    expect("customerNote" in body).toBe(false);
  });
});
