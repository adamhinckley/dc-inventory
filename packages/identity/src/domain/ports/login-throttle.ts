export type LoginAudience = "staff" | "wholesale" | "ops";

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
 * counters. A successful login clears both counters for that request.
 */
export interface ILoginThrottle {
  attempt(key: LoginThrottleKey): Promise<LoginThrottleResult>;
  reset(key: LoginThrottleKey): Promise<void>;
}
