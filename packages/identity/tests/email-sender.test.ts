import { describe, expect, it } from "vitest";
import { InMemoryEmailSender } from "../src/adapters/in-memory-email-sender.js";

describe("InMemoryEmailSender", () => {
  it("records sent messages without network I/O", async () => {
    const sender = new InMemoryEmailSender();
    await sender.send({
      to: "buyer@example.test",
      subject: "You're invited",
      text: "Set your password at https://example.test/invite",
    });
    await sender.send({
      to: "staff@example.test",
      subject: "Staff invite",
      html: "<p>Welcome</p>",
    });

    expect(sender.sent).toHaveLength(2);
    expect(sender.sent[0]).toEqual({
      to: "buyer@example.test",
      subject: "You're invited",
      text: "Set your password at https://example.test/invite",
    });
    expect(sender.sent[1]?.html).toBe("<p>Welcome</p>");
  });

  it("clear resets the capture buffer", async () => {
    const sender = new InMemoryEmailSender();
    await sender.send({ to: "a@example.test", subject: "Hi", text: "body" });
    sender.clear();
    expect(sender.sent).toEqual([]);
  });
});
