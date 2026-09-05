import { describe, expect, it } from "vitest";
import {
  CHECKOUT_ACCOUNT_PATH,
  CHECKOUT_EMPTY_SHIP_TOS_ACCOUNT_CTA,
  CHECKOUT_EMPTY_SHIP_TOS_MESSAGE,
} from "./checkout-empty-copy";

describe("checkout empty ship-tos copy", () => {
  it("points buyers at /account without inventing an account manager", () => {
    expect(CHECKOUT_EMPTY_SHIP_TOS_MESSAGE).toBe("No ship-to addresses on file.");
    expect(CHECKOUT_ACCOUNT_PATH).toBe("/account");
    expect(CHECKOUT_EMPTY_SHIP_TOS_ACCOUNT_CTA.toLowerCase()).toContain("account");
    expect(CHECKOUT_EMPTY_SHIP_TOS_ACCOUNT_CTA.toLowerCase()).not.toContain(
      "account manager",
    );
  });
});
