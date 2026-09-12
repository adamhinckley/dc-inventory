import type { StaffUserId } from "@dc-inventory/shared-kernel";
import type { EmailMessage } from "../domain/ports/email-sender.js";

export type StaffInviteEmailInput = {
  organizationName: string;
  organizationSlug: string;
  staffDisplayName: string;
  staffEmail: string;
  staffUserId: StaffUserId;
  setPasswordUrl: string;
};

export function buildStaffInviteEmail(input: StaffInviteEmailInput): EmailMessage {
  return {
    to: input.staffEmail,
    subject: `You're invited to ${input.organizationName}`,
    text: [
      `Hi ${input.staffDisplayName},`,
      "",
      `You've been invited as an admin for ${input.organizationName}.`,
      `Set your password to sign in: ${input.setPasswordUrl}`,
      "",
      `Organization slug: ${input.organizationSlug}`,
    ].join("\n"),
  };
}
