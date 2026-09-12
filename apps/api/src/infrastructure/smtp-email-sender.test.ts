import { describe, expect, it } from "vitest";
import { SmtpEmailSender } from "./smtp-email-sender.js";

describe("SmtpEmailSender", () => {
  it("rejects messages without text or html", async () => {
    const sender = new SmtpEmailSender({
      host: "localhost",
      port: 1025,
      from: "noreply@dc-inventory.test",
      secure: false,
    });
    await expect(
      sender.send({ to: "buyer@example.test", subject: "Invite" }),
    ).rejects.toThrow(/requires text or html/);
  });
});
