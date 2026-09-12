import type { StaffUserId } from "@dc-inventory/shared-kernel";
import type { EmailMessage } from "../domain/ports/email-sender.js";

export type StaffInviteEmailInput = {
  organizationName: string;
  organizationSlug: string;
  staffDisplayName: string;
  staffEmail: string;
  staffUserId: StaffUserId;
  setPasswordUrl: string;
  /** Tier 1 first admin vs tier 3 additional staff — default admin. */
  inviteKind?: "admin" | "staff";
};

function inviteBody(organizationName: string, inviteKind: "admin" | "staff"): string {
  return inviteKind === "staff"
    ? `You've been invited to join ${organizationName} as staff.`
    : `You've been invited as an admin for ${organizationName}.`;
}

export function buildStaffInviteEmail(input: StaffInviteEmailInput): EmailMessage {
  const inviteKind = input.inviteKind ?? "admin";

  return {
    to: input.staffEmail,
    subject: `You're invited to ${input.organizationName}`,
    text: [
      `Hi ${input.staffDisplayName},`,
      "",
      inviteBody(input.organizationName, inviteKind),
      `Set your password to sign in: ${input.setPasswordUrl}`,
      "",
      `Organization slug: ${input.organizationSlug}`,
    ].join("\n"),
  };
}
