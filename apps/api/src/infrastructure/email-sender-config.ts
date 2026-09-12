import type { IEmailSender } from "@dc-inventory/identity";
import { InMemoryEmailSender } from "@dc-inventory/identity";
import { SmtpEmailSender } from "./smtp-email-sender.js";

export type SmtpEmailConfig = {
  host: string;
  port: number;
  from: string;
  secure: boolean;
};

export function readSmtpEmailConfig(
  env: NodeJS.ProcessEnv = process.env,
): SmtpEmailConfig | null {
  const host = env.SMTP_HOST?.trim();
  if (!host) {
    return null;
  }
  const portRaw = env.SMTP_PORT?.trim() ?? "1025";
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid SMTP_PORT: ${portRaw}`);
  }
  const from = env.SMTP_FROM?.trim() ?? "noreply@dc-inventory.test";
  const secure = env.SMTP_SECURE?.trim() === "1";
  return { host, port, from, secure };
}

/** SMTP when configured; otherwise the in-memory capture used by unit tests. */
export function createEmailSenderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): IEmailSender {
  const config = readSmtpEmailConfig(env);
  if (!config) {
    return new InMemoryEmailSender();
  }
  return new SmtpEmailSender(config);
}
