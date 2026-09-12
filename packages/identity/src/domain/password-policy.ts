export const PASSWORD_MIN_LENGTH = 8;

export type PasswordPolicyViolation =
  | "too_short"
  | "missing_uppercase"
  | "missing_lowercase"
  | "missing_number";

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; violation: PasswordPolicyViolation };

/** Locked onboarding policy: 8+ chars with upper, lower, and number. */
export const PASSWORD_POLICY_UI_COPY =
  "At least 8 characters with one uppercase letter, one lowercase letter, and one number.";

const HAS_UPPERCASE = /[A-Z]/;
const HAS_LOWERCASE = /[a-z]/;
const HAS_NUMBER = /[0-9]/;

export function validatePassword(password: string): PasswordPolicyResult {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, violation: "too_short" };
  }
  if (!HAS_UPPERCASE.test(password)) {
    return { ok: false, violation: "missing_uppercase" };
  }
  if (!HAS_LOWERCASE.test(password)) {
    return { ok: false, violation: "missing_lowercase" };
  }
  if (!HAS_NUMBER.test(password)) {
    return { ok: false, violation: "missing_number" };
  }
  return { ok: true };
}

export function isPasswordPolicyCompliant(password: string): boolean {
  return validatePassword(password).ok;
}
