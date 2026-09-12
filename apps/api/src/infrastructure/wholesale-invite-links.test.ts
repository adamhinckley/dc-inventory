import { describe, expect, it } from "vitest";
import { buildWholesaleSetPasswordUrl } from "./wholesale-invite-links.js";

describe("buildWholesaleSetPasswordUrl", () => {
  it("persists organization, email, and name for the set-password page", () => {
    expect(
      buildWholesaleSetPasswordUrl(
        "http://dc-wholesale.test:3002",
        "raw-token",
        "acme",
        "buyer@harbor.test",
        "Harbor Supply",
      ),
    ).toBe(
      "http://dc-wholesale.test:3002/set-password?token=raw-token&organization=acme&email=buyer%40harbor.test&name=Harbor+Supply",
    );
  });
});
