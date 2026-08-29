import { createHash } from "node:crypto";
import { and, eq, or, sql } from "drizzle-orm";
import type { IClock } from "../domain/clock.js";
import {
  LOGIN_THROTTLE_WINDOW_MS,
  loginThrottleResult,
} from "../domain/login-throttle-policy.js";
import type {
  ILoginThrottle,
  LoginThrottleKey,
  LoginThrottleResult,
} from "../domain/ports/login-throttle.js";
import { loginThrottleCounters } from "../persistence/schema.js";
import type { IdentityDrizzle } from "./drizzle-staff-user-repository.js";

export class DrizzleLoginThrottle implements ILoginThrottle {
  constructor(
    private readonly db: IdentityDrizzle,
    private readonly clock: IClock,
  ) {}

  async attempt(key: LoginThrottleKey): Promise<LoginThrottleResult> {
    const at = this.clock.now();
    const expiredBefore = new Date(at.getTime() - LOGIN_THROTTLE_WINDOW_MS);
    const counters = await this.db
      .insert(loginThrottleCounters)
      .values([
        counterValue(key.audience, "source", key.source, at),
        counterValue(
          key.audience,
          "account_identifier",
          key.accountIdentifier,
          at,
        ),
      ])
      .onConflictDoUpdate({
        target: [
          loginThrottleCounters.audience,
          loginThrottleCounters.dimension,
          loginThrottleCounters.keyHash,
        ],
        set: {
          attemptCount: sql<number>`case
            when ${loginThrottleCounters.windowStartedAt} <= ${expiredBefore} then 1
            else ${loginThrottleCounters.attemptCount} + 1
          end`,
          windowStartedAt: sql<Date>`case
            when ${loginThrottleCounters.windowStartedAt} <= ${expiredBefore} then ${at}
            else ${loginThrottleCounters.windowStartedAt}
          end`,
          updatedAt: at,
        },
      })
      .returning({
        attemptCount: loginThrottleCounters.attemptCount,
        windowStartedAt: loginThrottleCounters.windowStartedAt,
      });
    if (counters.length !== 2) {
      throw new Error("login throttle upsert did not return both counters");
    }
    const rejected = counters
      .map((counter) =>
        loginThrottleResult(counter.attemptCount, counter.windowStartedAt, at),
      )
      .filter(
        (result): result is Extract<LoginThrottleResult, { allowed: false }> =>
          !result.allowed,
      );
    if (rejected.length === 0) {
      return { allowed: true };
    }
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        ...rejected.map((result) => result.retryAfterSeconds),
      ),
    };
  }

  async reset(key: LoginThrottleKey): Promise<void> {
    await this.db
      .delete(loginThrottleCounters)
      .where(
        and(
          eq(loginThrottleCounters.audience, key.audience),
          or(
            and(
              eq(loginThrottleCounters.dimension, "source"),
              eq(loginThrottleCounters.keyHash, hash(key.source)),
            ),
            and(
              eq(loginThrottleCounters.dimension, "account_identifier"),
              eq(loginThrottleCounters.keyHash, hash(key.accountIdentifier)),
            ),
          ),
        ),
      );
  }
}

function counterValue(
  audience: LoginThrottleKey["audience"],
  dimension: "source" | "account_identifier",
  value: string,
  at: Date,
) {
  return {
    audience,
    dimension,
    keyHash: hash(value),
    attemptCount: 1,
    windowStartedAt: at,
    updatedAt: at,
  };
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
