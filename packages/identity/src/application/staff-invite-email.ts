import type { StaffUserId } from "@dc-inventory/shared-kernel";
import type { EmailMessage } from "../domain/ports/email-sender.js";
import { inviteEmailHtml } from "./invite-email-html.js";

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

function inviteParagraph(organizationName: string, inviteKind: "admin" | "staff"): string {
  return inviteKind === "staff"
    ? `You've been invited to join ${organizationName} as staff. Choose a password and you can sign in.`
    : `You're the first admin for ${organizationName}. Choose a password and you can sign in.`;
}

function slugLine(organizationSlug: string): string {
  return `When you sign in, use this email and the organization slug ${organizationSlug}.`;
}

export function buildStaffInviteEmail(input: StaffInviteEmailInput): EmailMessage {
  const inviteKind = input.inviteKind ?? "admin";
  const paragraph = inviteParagraph(input.organizationName, inviteKind);
  const after = slugLine(input.organizationSlug);

  return {
    to: input.staffEmail,
    subject: `You're invited to ${input.organizationName}`,
    text: [
      `Hello ${input.staffDisplayName},`,
      "",
      paragraph,
      "",
      `Set your password: ${input.setPasswordUrl}`,
      "",
      after,
    ].join("\n"),
    html: inviteEmailHtml({
      greetingName: input.staffDisplayName,
      paragraphs: [paragraph],
      setPasswordUrl: input.setPasswordUrl,
      afterButton: [after],
    }),
  };
}
