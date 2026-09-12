import { PASSWORD_POLICY_UI_COPY as fromIdentity } from "@dc-inventory/identity";
import { describe, expect, it } from "vitest";
import {
  PASSWORD_MISMATCH_COPY,
  PASSWORD_POLICY_UI_COPY,
  readMatchingNewPassword,
} from "./password-policy-ui-copy.js";

describe("password policy UI copy", () => {
  it("stays in lockstep with identity", () => {
    expect(PASSWORD_POLICY_UI_COPY).toBe(fromIdentity);
  });
});

describe("readMatchingNewPassword", () => {
  it("rejects when confirm differs", () => {
    expect(readMatchingNewPassword("Harbor1Abc", "Harbor1Abd")).toEqual({
      ok: false,
      error: PASSWORD_MISMATCH_COPY,
    });
  });

  it("returns the password when both fields match", () => {
    expect(readMatchingNewPassword("Harbor1Abc", "Harbor1Abc")).toEqual({
      ok: true,
      password: "Harbor1Abc",
    });
  });
});
