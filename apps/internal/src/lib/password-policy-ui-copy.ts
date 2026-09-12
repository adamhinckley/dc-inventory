/** Mirrors `PASSWORD_POLICY_UI_COPY` in @dc-inventory/identity (client-safe copy). */
export const PASSWORD_POLICY_UI_COPY =
  "At least 8 characters with one uppercase letter, one lowercase letter, and one number.";

export const PASSWORD_MISMATCH_COPY = "Passwords do not match.";

export function readMatchingNewPassword(
  password: string,
  confirmPassword: string,
): { ok: true; password: string } | { ok: false; error: string } {
  if (password !== confirmPassword) {
    return { ok: false, error: PASSWORD_MISMATCH_COPY };
  }
  return { ok: true, password };
}
