import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
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
    const sourceHash = hash(key.source);
    const accountIdentifierHash = hash(key.accountIdentifier);
    const expiredBefore = new Date(at.getTime() - LOGIN_THROTTLE_WINDOW_MS);
    const [counter] = await this.db
      .insert(loginThrottleCounters)
      .values({
        audience: key.audience,
        sourceHash,
        accountIdentifierHash,
        attemptCount: 1,
        windowStartedAt: at,
        updatedAt: at,
      })
      .onConflictDoUpdate({
        target: [
          loginThrottleCounters.audience,
          loginThrottleCounters.sourceHash,
          loginThrottleCounters.accountIdentifierHash,
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
      throw new Error("login throttle upsert returned no row");
    }
    return loginThrottleResult(counter.attemptCount, counter.windowStartedAt, at);
  }

  async reset(key: LoginThrottleKey): Promise<void> {
    await this.db
      .delete(loginThrottleCounters)
      .where(
        and(
          eq(loginThrottleCounters.audience, key.audience),
          eq(loginThrottleCounters.sourceHash, hash(key.source)),
          eq(loginThrottleCounters.accountIdentifierHash, hash(key.accountIdentifier)),
        ),
      );
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
