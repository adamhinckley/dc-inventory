import type { WholesaleUserId } from "@dc-inventory/shared-kernel";
import type { EmailMessage } from "../domain/ports/email-sender.js";
import { inviteEmailHtml } from "./invite-email-html.js";

export type WholesaleInviteEmailInput = {
  organizationName: string;
  organizationSlug: string;
  displayName: string;
  wholesaleEmail: string;
  wholesaleUserId: WholesaleUserId;
  setPasswordUrl: string;
};

export function buildWholesaleInviteEmail(input: WholesaleInviteEmailInput): EmailMessage {
  const paragraph = `You've been invited to shop wholesale with ${input.organizationName}. Choose a password and you can start ordering.`;
  const after = `When you sign in, use this email and the organization slug ${input.organizationSlug}.`;

  return {
    to: input.wholesaleEmail,
    subject: `You're invited to ${input.organizationName} wholesale`,
    text: [
      `Hello ${input.displayName},`,
      "",
      paragraph,
      "",
      `Set your password: ${input.setPasswordUrl}`,
      "",
      after,
    ].join("\n"),
    html: inviteEmailHtml({
      greetingName: input.displayName,
      paragraphs: [paragraph],
      setPasswordUrl: input.setPasswordUrl,
      afterButton: [after],
    }),
  };
}
