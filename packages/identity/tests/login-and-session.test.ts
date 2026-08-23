import {
  CustomerId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { InMemoryClock } from "../src/adapters/in-memory-clock.js";
import { InMemoryPasswordHasher } from "../src/adapters/in-memory-password-hasher.js";
import { InMemorySessionStore } from "../src/adapters/in-memory-session-store.js";
import { InMemoryStaffUserRepository } from "../src/adapters/in-memory-staff-user-repository.js";
import { InMemoryWholesaleUserRepository } from "../src/adapters/in-memory-wholesale-user-repository.js";
import { LoginStaffUseCase } from "../src/application/login-staff.js";
import { LoginWholesaleUseCase } from "../src/application/login-wholesale.js";
import { LogoutUseCase } from "../src/application/logout.js";
import {
  ResolveStaffSessionUseCase,
  ResolveWholesaleSessionUseCase,
} from "../src/application/resolve-session.js";
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS } from "../src/domain/session.js";

const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440001");
const WHOLESALE_ID = WholesaleUserId.parse("550e8400-e29b-41d4-a716-446655440002");
const CUSTOMER_ID = CustomerId.parse("550e8400-e29b-41d4-a716-446655440003");
const OTHER_CUSTOMER = CustomerId.parse("550e8400-e29b-41d4-a716-446655440004");

function harness(at = new Date("2026-08-23T02:00:00.000Z")) {
  const clock = new InMemoryClock(at);
  const passwords = new InMemoryPasswordHasher();
  const staffUsers = new InMemoryStaffUserRepository();
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const sessions = new InMemorySessionStore();
  return {
    clock,
    passwords,
    staffUsers,
    wholesaleUsers,
    sessions,
    loginStaff: new LoginStaffUseCase(staffUsers, sessions, passwords, clock),
    loginWholesale: new LoginWholesaleUseCase(
      wholesaleUsers,
      sessions,
      passwords,
      clock,
    ),
    resolveStaff: new ResolveStaffSessionUseCase(sessions, staffUsers, clock),
    resolveWholesale: new ResolveWholesaleSessionUseCase(
      sessions,
      wholesaleUsers,
      clock,
    ),
    logoutStaff: new LogoutUseCase(sessions, clock, "staff"),
    logoutWholesale: new LogoutUseCase(sessions, clock, "wholesale"),
  };
}

describe("Identity login and sessions (in-memory)", () => {
  it("logs in staff with email + password", async () => {
    const h = harness();
    await h.staffUsers.save({
      id: STAFF_ID,
      email: "staff@local.test",
      passwordHash: await h.passwords.hash("staff-secret"),
    });

    const result = await h.loginStaff.execute({
      email: "Staff@Local.Test",
      password: "staff-secret",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.staffUserId).toBe(STAFF_ID);
    expect(result.email).toBe("staff@local.test");
    const session = await h.resolveStaff.execute(result.sessionId);
    expect(session).toEqual({
      ok: true,
      staffUserId: STAFF_ID,
      email: "staff@local.test",
    });
  });

  it("rejects unknown email and wrong password without leaking which failed", async () => {
    const h = harness();
    await h.staffUsers.save({
      id: STAFF_ID,
      email: "staff@local.test",
      passwordHash: await h.passwords.hash("staff-secret"),
    });

    const unknown = await h.loginStaff.execute({
      email: "missing@local.test",
      password: "staff-secret",
    });
    const wrong = await h.loginStaff.execute({
      email: "staff@local.test",
      password: "nope",
    });

    expect(unknown).toEqual({ ok: false });
    expect(wrong).toEqual({ ok: false });
  });

  it("snapshots wholesale customerId onto the session at login", async () => {
    const h = harness();
    await h.wholesaleUsers.save({
      id: WHOLESALE_ID,
      email: "wholesale@local.test",
      passwordHash: await h.passwords.hash("wholesale-secret"),
      customerId: CUSTOMER_ID,
    });

    const result = await h.loginWholesale.execute({
      email: "wholesale@local.test",
      password: "wholesale-secret",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.customerId).toBe(CUSTOMER_ID);

    await h.wholesaleUsers.save({
      id: WHOLESALE_ID,
      email: "wholesale@local.test",
      passwordHash: await h.passwords.hash("wholesale-secret"),
      customerId: OTHER_CUSTOMER,
    });

    const session = await h.resolveWholesale.execute(result.sessionId);
    expect(session.ok).toBe(true);
    if (!session.ok) {
      return;
    }
    expect(session.customerId).toBe(CUSTOMER_ID);
    expect(session.wholesaleUserId).toBe(WHOLESALE_ID);
  });

  it("expires a session after idle 30 minutes via the clock", async () => {
    const h = harness();
    await h.staffUsers.save({
      id: STAFF_ID,
      email: "staff@local.test",
      passwordHash: await h.passwords.hash("staff-secret"),
    });
    const login = await h.loginStaff.execute({
      email: "staff@local.test",
      password: "staff-secret",
    });
    if (!login.ok) {
      throw new Error("expected login");
    }

    h.clock.advance(SESSION_IDLE_MS);
    const atBoundary = await h.resolveStaff.execute(login.sessionId);
    expect(atBoundary.ok).toBe(true);

    h.clock.advance(SESSION_IDLE_MS + 1);
    const expired = await h.resolveStaff.execute(login.sessionId);
    expect(expired).toEqual({ ok: false, reason: "expired" });
  });

  it("expires a session after absolute 8 hours even when idle is touched", async () => {
    const h = harness();
    await h.staffUsers.save({
      id: STAFF_ID,
      email: "staff@local.test",
      passwordHash: await h.passwords.hash("staff-secret"),
    });
    const login = await h.loginStaff.execute({
      email: "staff@local.test",
      password: "staff-secret",
    });
    if (!login.ok) {
      throw new Error("expected login");
    }

    const touchEvery = 20 * 60 * 1000;
    let elapsed = 0;
    while (elapsed + touchEvery < SESSION_ABSOLUTE_MS) {
      h.clock.advance(touchEvery);
      elapsed += touchEvery;
      const mid = await h.resolveStaff.execute(login.sessionId);
      expect(mid.ok).toBe(true);
    }

    h.clock.advance(SESSION_ABSOLUTE_MS - elapsed + 1);
    const expired = await h.resolveStaff.execute(login.sessionId);
    expect(expired).toEqual({ ok: false, reason: "expired" });
  });

  it("revokes on logout and treats the other audience as wrong_audience", async () => {
    const h = harness();
    await h.staffUsers.save({
      id: STAFF_ID,
      email: "staff@local.test",
      passwordHash: await h.passwords.hash("staff-secret"),
    });
    const login = await h.loginStaff.execute({
      email: "staff@local.test",
      password: "staff-secret",
    });
    if (!login.ok) {
      throw new Error("expected login");
    }

    const wrong = await h.resolveWholesale.execute(login.sessionId);
    expect(wrong).toEqual({ ok: false, reason: "wrong_audience" });

    const logout = await h.logoutStaff.execute(login.sessionId);
    expect(logout).toEqual({ ok: true });
    const after = await h.resolveStaff.execute(login.sessionId);
    expect(after).toEqual({ ok: false, reason: "invalid" });
  });

  it("keeps application/ free of Fastify, Drizzle, Zod, and hash libraries", () => {
    const dir = resolve(import.meta.dirname, "../src/application");
    const forbidden =
      /fastify|drizzle|zod|argon2|scrypt|bcrypt|better-auth|node:crypto|customers/i;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".ts")) {
        continue;
      }
      const source = readFileSync(resolve(dir, name), "utf8");
      expect(source, name).not.toMatch(forbidden);
    }
  });

  it("keeps domain/ free of Customers and adapter SDKs", () => {
    const root = resolve(import.meta.dirname, "../src/domain");
    const files = [
      ...readdirSync(root).filter((name) => name.endsWith(".ts")),
      ...readdirSync(resolve(root, "ports")).map((name) => `ports/${name}`),
    ];
    const forbidden = /fastify|drizzle|zod|argon2|scrypt|bcrypt|better-auth|customers/i;
    for (const name of files) {
      const source = readFileSync(resolve(root, name), "utf8");
      expect(source, name).not.toMatch(forbidden);
    }
  });
});
