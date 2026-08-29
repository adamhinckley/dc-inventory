import { createHash } from "node:crypto";
import { and, eq, lte, or, sql } from "drizzle-orm";
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

type CounterRow = {
  attemptCount: number;
  windowStartedAt: Date;
};

export class DrizzleLoginThrottle implements ILoginThrottle {
  constructor(
    private readonly db: IdentityDrizzle,
    private readonly clock: IClock,
  ) {}

  async attempt(key: LoginThrottleKey): Promise<LoginThrottleResult> {
    const at = this.clock.now();
    const expiredBefore = new Date(at.getTime() - LOGIN_THROTTLE_WINDOW_MS);
    await this.purgeExpired(expiredBefore);

    const sourceCounter = await this.upsertCounter(
      key.audience,
      "source",
      key.source,
      at,
      expiredBefore,
    );
    const sourceResult = loginThrottleResult(
      sourceCounter.attemptCount,
      sourceCounter.windowStartedAt,
      at,
    );
    if (!sourceResult.allowed) {
      return sourceResult;
    }

    const accountCounter = await this.upsertCounter(
      key.audience,
      "account_identifier",
      key.accountIdentifier,
      at,
      expiredBefore,
    );
    return loginThrottleResult(
      accountCounter.attemptCount,
      accountCounter.windowStartedAt,
      at,
    );
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

  private async purgeExpired(expiredBefore: Date): Promise<void> {
    await this.db
      .delete(loginThrottleCounters)
      .where(lte(loginThrottleCounters.windowStartedAt, expiredBefore));
  }

  private async upsertCounter(
    audience: LoginThrottleKey["audience"],
    dimension: "source" | "account_identifier",
    value: string,
    at: Date,
    expiredBefore: Date,
  ): Promise<CounterRow> {
    const [counter] = await this.db
      .insert(loginThrottleCounters)
      .values(counterValue(audience, dimension, value, at))
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
    if (counter === undefined) {
      throw new Error("login throttle upsert did not return a counter");
    }
    return counter;
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
