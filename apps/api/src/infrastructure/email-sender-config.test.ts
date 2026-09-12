import { describe, expect, it } from "vitest";
import { InMemoryEmailSender } from "@dc-inventory/identity";
import {
  createEmailSenderFromEnv,
  readSmtpEmailConfig,
} from "./email-sender-config.js";
import { SmtpEmailSender } from "./smtp-email-sender.js";

describe("readSmtpEmailConfig", () => {
  it("returns null when SMTP_HOST is unset", () => {
    expect(readSmtpEmailConfig({})).toBeNull();
    expect(readSmtpEmailConfig({ SMTP_HOST: "  " })).toBeNull();
  });

  it("defaults Mailpit-friendly host/port/from when SMTP_HOST is set", () => {
    expect(readSmtpEmailConfig({ SMTP_HOST: "localhost" })).toEqual({
      host: "localhost",
      port: 1025,
      from: "noreply@dc-inventory.test",
      secure: false,
    });
  });

  it("reads explicit SMTP env overrides", () => {
    expect(
      readSmtpEmailConfig({
        SMTP_HOST: "mailpit",
        SMTP_PORT: "2525",
        SMTP_FROM: "invites@example.test",
        SMTP_SECURE: "1",
      }),
    ).toEqual({
      host: "mailpit",
      port: 2525,
      from: "invites@example.test",
      secure: true,
    });
  });

  it("rejects invalid SMTP_PORT", () => {
    expect(() => readSmtpEmailConfig({ SMTP_HOST: "localhost", SMTP_PORT: "abc" })).toThrow(
      /Invalid SMTP_PORT/,
    );
  });
});

describe("createEmailSenderFromEnv", () => {
  it("returns InMemoryEmailSender when SMTP is not configured", () => {
    const sender = createEmailSenderFromEnv({});
    expect(sender).toBeInstanceOf(InMemoryEmailSender);
  });

  it("returns SmtpEmailSender when SMTP_HOST is set", () => {
    const sender = createEmailSenderFromEnv({ SMTP_HOST: "localhost" });
    expect(sender).toBeInstanceOf(SmtpEmailSender);
  });
});
