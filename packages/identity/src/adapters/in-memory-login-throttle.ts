import {
  LOGIN_THROTTLE_WINDOW_MS,
  loginThrottleResult,
} from "../domain/login-throttle-policy.js";
import type { IClock } from "../domain/clock.js";
import type {
  ILoginThrottle,
  LoginThrottleKey,
  LoginThrottleResult,
} from "../domain/ports/login-throttle.js";

type Counter = {
  attemptCount: number;
  windowStartedAt: Date;
};

export class InMemoryLoginThrottle implements ILoginThrottle {
  private readonly counters = new Map<string, Counter>();

  constructor(private readonly clock: IClock) {}

  async attempt(key: LoginThrottleKey): Promise<LoginThrottleResult> {
    const at = this.clock.now();
    const storageKey = serializeKey(key);
    const current = this.counters.get(storageKey);
    const windowExpired =
      current === undefined ||
      current.windowStartedAt.getTime() + LOGIN_THROTTLE_WINDOW_MS <= at.getTime();
    const counter: Counter = windowExpired
      ? { attemptCount: 1, windowStartedAt: at }
      : {
          attemptCount: current.attemptCount + 1,
          windowStartedAt: current.windowStartedAt,
        };
    this.counters.set(storageKey, counter);
    return loginThrottleResult(counter.attemptCount, counter.windowStartedAt, at);
  }

  async reset(key: LoginThrottleKey): Promise<void> {
    this.counters.delete(serializeKey(key));
  }
}

function serializeKey(key: LoginThrottleKey): string {
  return JSON.stringify([key.audience, key.source, key.accountIdentifier]);
}
