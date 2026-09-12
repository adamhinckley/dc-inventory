/** Outbound email payload. At least one of `text` or `html` must be set. */
export type EmailMessage = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

/** Platform email port. Invite and statement jobs depend on this — no ESP-specific APIs. */
export interface IEmailSender {
  send(message: EmailMessage): Promise<void>;
}
