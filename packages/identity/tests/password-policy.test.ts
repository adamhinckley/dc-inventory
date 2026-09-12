import { describe, expect, it } from "vitest";
import {
  PASSWORD_POLICY_UI_COPY,
  validatePassword,
} from "../src/domain/password-policy.js";

describe("password policy", () => {
  it("accepts a password that meets the locked policy", () => {
    expect(validatePassword("Secret1beta")).toEqual({ ok: true });
  });

  it("rejects passwords shorter than 8 characters", () => {
    expect(validatePassword("Ab1")).toEqual({ ok: false, violation: "too_short" });
  });

  it("rejects passwords missing an uppercase letter", () => {
    expect(validatePassword("secret1beta")).toEqual({
      ok: false,
      violation: "missing_uppercase",
    });
  });

  it("rejects passwords missing a lowercase letter", () => {
    expect(validatePassword("SECRET1BETA")).toEqual({
      ok: false,
      violation: "missing_lowercase",
    });
  });

  it("rejects passwords missing a number", () => {
    expect(validatePassword("Secretbeta")).toEqual({
      ok: false,
      violation: "missing_number",
    });
  });

  it("exposes UI copy that matches the locked policy", () => {
    expect(PASSWORD_POLICY_UI_COPY).toBe(
      "At least 8 characters with one uppercase letter, one lowercase letter, and one number.",
    );
  });
});
