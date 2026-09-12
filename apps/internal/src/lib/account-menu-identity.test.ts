import { describe, expect, it } from "vitest";
import { accountMenuIdentity } from "./account-menu-identity.js";

describe("accountMenuIdentity", () => {
  it("prefers the display name and keeps email for the account menu", () => {
    expect(
      accountMenuIdentity({
        displayName: "Pippy",
        email: "pippy@test.com",
      }),
    ).toEqual({
      displayName: "Pippy",
      email: "pippy@test.com",
    });
  });

  it("falls back to email when display name is missing", () => {
    expect(accountMenuIdentity({ email: "pippy@test.com" })).toEqual({
      displayName: "pippy@test.com",
      email: "pippy@test.com",
    });
  });
});
