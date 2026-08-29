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
 * `attempt` reserves one password check. A successful login clears that
 * source/account pair; failed attempts remain until the fixed window expires.
 */
export interface ILoginThrottle {
  attempt(key: LoginThrottleKey): Promise<LoginThrottleResult>;
  reset(key: LoginThrottleKey): Promise<void>;
}
