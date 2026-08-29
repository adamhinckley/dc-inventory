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
    this.purgeExpired(at);

    const sourceResult = this.increment(serializeKey(key, "source"), at);
    if (!sourceResult.allowed) {
      return sourceResult;
    }
    return this.increment(serializeKey(key, "account_identifier"), at);
  }

  async reset(key: LoginThrottleKey): Promise<void> {
    this.counters.delete(serializeKey(key, "source"));
    this.counters.delete(serializeKey(key, "account_identifier"));
  }

  hasStoredCounter(
    key: LoginThrottleKey,
    dimension: "source" | "account_identifier",
  ): boolean {
    return this.counters.has(serializeKey(key, dimension));
  }

  storedCounterCount(): number {
    return this.counters.size;
  }

  private purgeExpired(at: Date): void {
    for (const [storageKey, counter] of this.counters) {
      if (counter.windowStartedAt.getTime() + LOGIN_THROTTLE_WINDOW_MS <= at.getTime()) {
        this.counters.delete(storageKey);
      }
    }
  }

  private increment(storageKey: string, at: Date): LoginThrottleResult {
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
}

function serializeKey(
  key: LoginThrottleKey,
  dimension: "source" | "account_identifier",
): string {
  const value = dimension === "source" ? key.source : key.accountIdentifier;
  return JSON.stringify([key.audience, dimension, value]);
}
