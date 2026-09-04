import { describe, expect, it } from "vitest";
import { postLoginPath } from "./post-login-path";

describe("postLoginPath", () => {
  it("sends buyers to products after login", () => {
    expect(
      postLoginPath({
        mode: "buyer",
        customerId: "00000000-0000-0000-0000-000000000002",
      }),
    ).toBe("/products");
  });

  it("sends staff acting without a customer to the picker", () => {
    expect(
      postLoginPath({
        mode: "staff_acting",
        customerId: null,
      }),
    ).toBe("/select-customer");
  });

  it("sends staff acting with a bound customer to products", () => {
    expect(
      postLoginPath({
        mode: "staff_acting",
        customerId: "00000000-0000-0000-0000-000000000005",
      }),
    ).toBe("/products");
  });
});
