import { StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { buildStaffInviteEmail } from "../src/application/staff-invite-email.js";

const STAFF_USER_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440301");
const SET_PASSWORD_URL =
  "https://internal.test/set-password?token=invite-token&organization=harbor-wholesale";

describe("buildStaffInviteEmail", () => {
  it("greets the first admin by name and tells them to set a password", () => {
    const message = buildStaffInviteEmail({
      organizationName: "Harbor Wholesale",
      organizationSlug: "harbor-wholesale",
      staffDisplayName: "Jordan Hale",
      staffEmail: "jordan@harbor.test",
      staffUserId: STAFF_USER_ID,
      setPasswordUrl: SET_PASSWORD_URL,
    });

    expect(message.to).toBe("jordan@harbor.test");
    expect(message.subject).toBe("You're invited to Harbor Wholesale");
    expect(message.text).toContain("Hello Jordan Hale,");
    expect(message.text).toContain("first admin for Harbor Wholesale");
    expect(message.text).toContain("Choose a password");
    expect(message.text).toContain(SET_PASSWORD_URL);
    expect(message.text).toContain("harbor-wholesale");
    expect(message.html).toContain("Hello Jordan Hale,");
    expect(message.html).toContain(
      'href="https://internal.test/set-password?token=invite-token&amp;organization=harbor-wholesale"',
    );
    expect(message.html).toContain("Set your password");
  });

  it("uses staff copy for additional invites and escapes HTML in the name", () => {
    const message = buildStaffInviteEmail({
      organizationName: "Harbor Wholesale",
      organizationSlug: "harbor-wholesale",
      staffDisplayName: `Pat <img src="x"> Lee`,
      staffEmail: "pat@harbor.test",
      staffUserId: STAFF_USER_ID,
      setPasswordUrl: SET_PASSWORD_URL,
      inviteKind: "staff",
    });

    expect(message.text).toContain("Hello Pat <img src=\"x\"> Lee,");
    expect(message.text).toContain("join Harbor Wholesale as staff");
    expect(message.html).not.toContain("<img src=");
    expect(message.html).toContain("Pat &lt;img src=&quot;x&quot;&gt; Lee");
  });
});
