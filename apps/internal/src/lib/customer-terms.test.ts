import { describe, expect, it } from "vitest";
import { CUSTOMER_TERMS, customerTermsSelectOptions } from "./customer-terms.js";

describe("customer terms select", () => {
  it("offers Net 30, 60, and 90", () => {
    expect(CUSTOMER_TERMS).toEqual(["Net 30", "Net 60", "Net 90"]);
    expect(customerTermsSelectOptions().map((option) => option.value)).toEqual([
      "Net 30",
      "Net 60",
      "Net 90",
    ]);
  });

  it("keeps an existing free-text term so edit does not drop it", () => {
    expect(customerTermsSelectOptions("Due on receipt").map((option) => option.value)).toEqual([
      "Net 30",
      "Net 60",
      "Net 90",
      "Due on receipt",
    ]);
  });
});
