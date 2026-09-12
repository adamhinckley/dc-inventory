import type { EmailMessage, IEmailSender } from "@dc-inventory/identity";
import nodemailer from "nodemailer";
import type { SmtpEmailConfig } from "./email-sender-config.js";

function assertBody(message: EmailMessage): { text?: string; html?: string } {
  const text = message.text?.trim();
  const html = message.html?.trim();
  if (!text && !html) {
    throw new Error("EmailMessage requires text or html");
  }
  return {
    text: text || undefined,
    html: html || undefined,
  };
}

/** Generic SMTP adapter — Mailpit locally; any SMTP relay in other environments. */
export class SmtpEmailSender implements IEmailSender {
  private readonly transport;
  private readonly from: string;

  constructor(config: SmtpEmailConfig) {
    this.from = config.from;
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ignoreTLS: !config.secure,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    const body = assertBody(message);
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      ...body,
    });
  }
}
