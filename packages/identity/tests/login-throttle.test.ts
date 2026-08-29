import { describe, expect, it } from "vitest";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { InMemoryLoginThrottle } from "../src/adapters/in-memory-login-throttle.js";
import {
  LOGIN_THROTTLE_MAX_ATTEMPTS,
  LOGIN_THROTTLE_WINDOW_MS,
} from "../src/domain/login-throttle-policy.js";
import type { LoginThrottleKey } from "../src/domain/ports/login-throttle.js";

const START = new Date("2026-08-29T01:00:00.000Z");
const STAFF_KEY: LoginThrottleKey = {
  audience: "staff",
  source: "203.0.113.10",
  accountIdentifier: "acme\u0000person@example.com",
};

describe("login throttling", () => {
  it("rejects repeated attempts with a stable retry interval", async () => {
    const clock = new InMemoryClock(START);
    const throttle = new InMemoryLoginThrottle(clock);

    for (let attempt = 0; attempt < LOGIN_THROTTLE_MAX_ATTEMPTS; attempt += 1) {
      await expect(throttle.attempt(STAFF_KEY)).resolves.toEqual({ allowed: true });
    }
    await expect(throttle.attempt(STAFF_KEY)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: LOGIN_THROTTLE_WINDOW_MS / 1000,
    });

    clock.advance(LOGIN_THROTTLE_WINDOW_MS);
    await expect(throttle.attempt(STAFF_KEY)).resolves.toEqual({ allowed: true });
  });

  it("resets the source/account counter after a successful login", async () => {
    const throttle = new InMemoryLoginThrottle(new InMemoryClock(START));

    for (let attempt = 0; attempt < LOGIN_THROTTLE_MAX_ATTEMPTS; attempt += 1) {
      await throttle.attempt(STAFF_KEY);
    }
    await throttle.reset(STAFF_KEY);

    await expect(throttle.attempt(STAFF_KEY)).resolves.toEqual({ allowed: true });
  });

  it("keeps audiences, sources, and account identifiers independent", async () => {
    const throttle = new InMemoryLoginThrottle(new InMemoryClock(START));

    for (let attempt = 0; attempt <= LOGIN_THROTTLE_MAX_ATTEMPTS; attempt += 1) {
      await throttle.attempt(STAFF_KEY);
    }

    await expect(
      throttle.attempt({ ...STAFF_KEY, audience: "wholesale" }),
    ).resolves.toEqual({ allowed: true });
    await expect(throttle.attempt({ ...STAFF_KEY, audience: "ops" })).resolves.toEqual({
      allowed: true,
    });
    await expect(
      throttle.attempt({ ...STAFF_KEY, source: "203.0.113.11" }),
    ).resolves.toMatchObject({ allowed: false });
    await expect(
      throttle.attempt({
        ...STAFF_KEY,
        accountIdentifier: "acme\u0000other@example.com",
      }),
    ).resolves.toMatchObject({ allowed: false });
    await expect(
      throttle.attempt({
        ...STAFF_KEY,
        source: "203.0.113.11",
        accountIdentifier: "acme\u0000other@example.com",
      }),
    ).resolves.toEqual({ allowed: true });
  });

  it("does not increment account counters when the source is already blocked", async () => {
    const throttle = new InMemoryLoginThrottle(new InMemoryClock(START));
    const freshAccount = "acme\u0000fresh@example.com";

    for (let attempt = 0; attempt <= LOGIN_THROTTLE_MAX_ATTEMPTS; attempt += 1) {
      await throttle.attempt(STAFF_KEY);
    }

    for (let attempt = 0; attempt <= LOGIN_THROTTLE_MAX_ATTEMPTS + 3; attempt += 1) {
      await expect(
        throttle.attempt({
          ...STAFF_KEY,
          accountIdentifier: freshAccount,
        }),
      ).resolves.toMatchObject({ allowed: false });
    }

    await expect(
      throttle.attempt({
        ...STAFF_KEY,
        source: "203.0.113.11",
        accountIdentifier: freshAccount,
      }),
    ).resolves.toEqual({ allowed: true });
  });

  it("purges expired counters without disturbing active windows", async () => {
    const clock = new InMemoryClock(START);
    const throttle = new InMemoryLoginThrottle(clock);
    const staleKey: LoginThrottleKey = {
      ...STAFF_KEY,
      source: "203.0.113.99",
      accountIdentifier: "acme\u0000stale@example.com",
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await throttle.attempt(staleKey);
    }
    expect(throttle.hasStoredCounter(staleKey, "account_identifier")).toBe(true);

    clock.advance(LOGIN_THROTTLE_WINDOW_MS + 1);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await throttle.attempt(STAFF_KEY);
    }
    expect(throttle.hasStoredCounter(STAFF_KEY, "source")).toBe(true);

    await throttle.attempt({
      ...STAFF_KEY,
      source: "203.0.113.55",
      accountIdentifier: "acme\u0000purge-trigger@example.com",
    });

    expect(throttle.hasStoredCounter(staleKey, "account_identifier")).toBe(false);
    expect(throttle.hasStoredCounter(staleKey, "source")).toBe(false);
    expect(throttle.hasStoredCounter(STAFF_KEY, "source")).toBe(true);

    const remainingAttempts = LOGIN_THROTTLE_MAX_ATTEMPTS - 2;
    for (let attempt = 0; attempt < remainingAttempts; attempt += 1) {
      await expect(throttle.attempt(STAFF_KEY)).resolves.toEqual({ allowed: true });
    }
    await expect(throttle.attempt(STAFF_KEY)).resolves.toMatchObject({ allowed: false });
  });
});
