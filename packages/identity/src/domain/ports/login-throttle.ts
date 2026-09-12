export type LoginAudience = "staff" | "wholesale" | "ops" | "platform";

export type LoginThrottleKey = {
  audience: LoginAudience;
  source: string;
  accountIdentifier: string;
};

export type LoginThrottleResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Shared login-throttling port for all three audiences.
 *
 * `attempt` reserves one password check against independent source and account
 * counters. Source is evaluated first; a blocked source does not touch the
 * account counter. Expired counter rows are purged on each attempt. A
 * successful login clears both counters for that request.
 */
export interface ILoginThrottle {
  attempt(key: LoginThrottleKey): Promise<LoginThrottleResult>;
  reset(key: LoginThrottleKey): Promise<void>;
}
