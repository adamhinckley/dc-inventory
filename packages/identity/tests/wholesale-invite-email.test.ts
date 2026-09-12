import { WholesaleUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { buildWholesaleInviteEmail } from "../src/application/wholesale-invite-email.js";

const WHOLESALE_USER_ID = WholesaleUserId.parse("550e8400-e29b-41d4-a716-446655440302");
const SET_PASSWORD_URL =
  "https://shop.test/set-password?token=invite-token&organization=acme";

describe("buildWholesaleInviteEmail", () => {
  it("greets the buyer by name and tells them to set a password", () => {
    const message = buildWholesaleInviteEmail({
      organizationName: "Acme Wholesale",
      organizationSlug: "acme",
      displayName: "Summit Retail",
      wholesaleEmail: "buyer@summit.test",
      wholesaleUserId: WHOLESALE_USER_ID,
      setPasswordUrl: SET_PASSWORD_URL,
    });

    expect(message.to).toBe("buyer@summit.test");
    expect(message.subject).toBe("You're invited to Acme Wholesale wholesale");
    expect(message.text).toContain("Hello Summit Retail,");
    expect(message.text).toContain("shop wholesale with Acme Wholesale");
    expect(message.text).toContain("Choose a password");
    expect(message.text).toContain(SET_PASSWORD_URL);
    expect(message.text).toContain("acme");
    expect(message.html).toContain("Hello Summit Retail,");
    expect(message.html).toContain(
      'href="https://shop.test/set-password?token=invite-token&amp;organization=acme"',
    );
    expect(message.html).toContain("Set your password");
  });
});
