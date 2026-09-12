import type { EmailMessage, IEmailSender } from "../domain/ports/email-sender.js";

/** Captures sent messages for unit tests — no SMTP, no real addresses. */
export class InMemoryEmailSender implements IEmailSender {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push({ ...message });
  }

  clear(): void {
    this.sent.length = 0;
  }
}
