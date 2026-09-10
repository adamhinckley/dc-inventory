import { describe, expect, it } from "vitest";
import { DrizzleLoginThrottle } from "../src/adapters/drizzle-login-throttle.js";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import type { LoginThrottleKey } from "../src/domain/ports/login-throttle.js";

const START = new Date("2026-08-29T01:00:00.000Z");
const STAFF_KEY: LoginThrottleKey = {
  audience: "staff",
  source: "203.0.113.10",
  accountIdentifier: "acme\u0000person@example.com",
};

function isSql(node: unknown): node is { queryChunks: unknown[] } {
  return (
    typeof node === "object" &&
    node !== null &&
    "decoder" in node &&
    "queryChunks" in node &&
    Array.isArray((node as { queryChunks: unknown }).queryChunks)
  );
}

function isParam(node: unknown): node is { value: unknown } {
  return typeof node === "object" && node !== null && "encoder" in node && "value" in node;
}

function boundSqlValues(node: unknown): unknown[] {
  const values: unknown[] = [];
  function walk(current: unknown): void {
    if (isParam(current)) {
      values.push(current.value);
      return;
    }
    if (isSql(current)) {
      for (const chunk of current.queryChunks) {
        walk(chunk);
      }
      return;
    }
    if (
      current instanceof Date ||
      typeof current === "string" ||
      typeof current === "number"
    ) {
      values.push(current);
    }
  }
  walk(node);
  return values;
}

function boundSqlValuesFromSet(set: unknown): unknown[] {
  if (set === null || typeof set !== "object") {
    return [];
  }
  return Object.values(set)
    .filter((value) => isSql(value))
    .flatMap((value) => boundSqlValues(value));
}

class CapturingIdentityDb {
  readonly conflictSets: unknown[] = [];
  purgeDeleteCallCount = 0;

  delete() {
    return {
      where: async () => {
        this.purgeDeleteCallCount += 1;
      },
    };
  }

  insert() {
    return {
      values: () => ({
        onConflictDoUpdate: (args: { set: unknown }) => {
          this.conflictSets.push(args.set);
          return {
            returning: async () => [
              { attemptCount: 1, windowStartedAt: START },
            ],
          };
        },
      }),
    };
  }
}

describe("DrizzleLoginThrottle", () => {
  it("does not run a global purge on every failed attempt", async () => {
    const db = new CapturingIdentityDb();
    const throttle = new DrizzleLoginThrottle(db as never, new InMemoryClock(START));

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await throttle.attempt(STAFF_KEY);
    }

    expect(db.purgeDeleteCallCount).toBe(1);
  });

  it("binds upsert window timestamps as ISO strings", async () => {
    const db = new CapturingIdentityDb();
    const throttle = new DrizzleLoginThrottle(db as never, new InMemoryClock(START));

    await expect(throttle.attempt(STAFF_KEY)).resolves.toEqual({ allowed: true });

    const sqlParams = db.conflictSets.flatMap(boundSqlValuesFromSet);
    expect(sqlParams.filter((value) => value instanceof Date)).toEqual([]);
    expect(sqlParams).toEqual(
      expect.arrayContaining([
        "2026-08-29T01:00:00.000Z",
        "2026-08-29T00:45:00.000Z",
      ]),
    );
  });
});
