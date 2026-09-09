import { describe, expect, it } from "vitest";
import { buildUpdateCustomerBody } from "./customer-edit-body";

const BASE_CUSTOMER = {
  name: "Acme Wholesale",
  terms: "Net 30",
  creditLimitCents: 1_000_000,
  currency: "USD",
  taxId: "12-345",
  accountStatus: "active" as const,
  staffNote: "VIP",
};

const BASE_FORM = {
  name: "Acme Wholesale",
  terms: "Net 30",
  creditLimitCents: 1_000_000,
  taxId: "12-345",
  accountStatus: "active" as const,
  staffNote: "VIP",
};

describe("buildUpdateCustomerBody", () => {
  it("does not send customerNote from staff edit", () => {
    const body = buildUpdateCustomerBody(BASE_CUSTOMER, BASE_FORM);
    expect("customerNote" in body).toBe(false);
  });

  it("returns an empty patch when nothing changed", () => {
    expect(buildUpdateCustomerBody(BASE_CUSTOMER, BASE_FORM)).toEqual({});
  });

  it("sends only master-data fields when purchasing edits name on Save Changes", () => {
    const body = buildUpdateCustomerBody(BASE_CUSTOMER, {
      ...BASE_FORM,
      name: "Acme Wholesale Updated",
    });

    expect(body).toEqual({ name: "Acme Wholesale Updated" });
    expect(body).not.toHaveProperty("creditLimitCents");
    expect(body).not.toHaveProperty("currency");
  });

  it("sends only credit limit when accounting edits credit on Save Changes", () => {
    const body = buildUpdateCustomerBody(BASE_CUSTOMER, {
      ...BASE_FORM,
      creditLimitCents: 2_000_000,
    });

    expect(body).toEqual({ creditLimitCents: 2_000_000 });
    expect(body).not.toHaveProperty("name");
    expect(body).not.toHaveProperty("currency");
  });

  it("includes both field groups when name and credit limit change", () => {
    const body = buildUpdateCustomerBody(BASE_CUSTOMER, {
      ...BASE_FORM,
      name: "Acme Wholesale Updated",
      creditLimitCents: 2_000_000,
    });

    expect(body).toEqual({
      name: "Acme Wholesale Updated",
      creditLimitCents: 2_000_000,
    });
  });

  it("normalizes trimmed optional text before diffing", () => {
    const body = buildUpdateCustomerBody(BASE_CUSTOMER, {
      ...BASE_FORM,
      taxId: " 12-345 ",
      staffNote: " VIP ",
    });

    expect(body).toEqual({});
  });
});
