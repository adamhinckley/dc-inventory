import type { LoginThrottleResult } from "./ports/login-throttle.js";

export const LOGIN_THROTTLE_MAX_ATTEMPTS = 5;
export const LOGIN_THROTTLE_WINDOW_MS = 15 * 60 * 1000;

export function loginThrottleResult(
  attemptCount: number,
  windowStartedAt: Date,
  at: Date,
): LoginThrottleResult {
  if (attemptCount <= LOGIN_THROTTLE_MAX_ATTEMPTS) {
    return { allowed: true };
  }
  const remainingMs =
    windowStartedAt.getTime() + LOGIN_THROTTLE_WINDOW_MS - at.getTime();
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
  };
}
