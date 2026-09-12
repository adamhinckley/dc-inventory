import { describe, expect, it } from "vitest";
import { buildInternalSetPasswordUrl } from "./staff-invite-links.js";

describe("buildInternalSetPasswordUrl", () => {
  it("persists organization and email for the set-password → login handoff", () => {
    expect(
      buildInternalSetPasswordUrl(
        "http://dc-internal.test:3000",
        "raw-token",
        "harbor-wholesale",
        "owner@harbor.test",
        "Harbor Owner",
      ),
    ).toBe(
      "http://dc-internal.test:3000/set-password?token=raw-token&organization=harbor-wholesale&email=owner%40harbor.test&name=Harbor+Owner",
    );
  });
});
