import type { WholesaleUserId } from "@dc-inventory/shared-kernel";
import type { EmailMessage } from "../domain/ports/email-sender.js";

export type WholesaleInviteEmailInput = {
  organizationName: string;
  organizationSlug: string;
  displayName: string;
  wholesaleEmail: string;
  wholesaleUserId: WholesaleUserId;
  setPasswordUrl: string;
};

export function buildWholesaleInviteEmail(input: WholesaleInviteEmailInput): EmailMessage {
  return {
    to: input.wholesaleEmail,
    subject: `You're invited to ${input.organizationName} wholesale`,
    text: [
      `Hi ${input.displayName},`,
      "",
      `You've been invited to shop wholesale with ${input.organizationName}.`,
      `Set your password to sign in: ${input.setPasswordUrl}`,
      "",
      `Organization slug: ${input.organizationSlug}`,
    ].join("\n"),
  };
}
