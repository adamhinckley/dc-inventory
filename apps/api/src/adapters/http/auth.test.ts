import {
  CustomerId,
  OrganizationId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import {
  InMemoryClock,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  InMemoryWholesaleUserRepository,
  LOGIN_THROTTLE_MAX_ATTEMPTS,
  LOGIN_THROTTLE_WINDOW_MS,
  SESSION_IDLE_MS,
} from "@dc-inventory/identity";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import {
  STAFF_SESSION_COOKIE,
  WHOLESALE_SESSION_COOKIE,
} from "./auth-cookies.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const WHOLESALE_ID = WholesaleUserId.parse("22222222-2222-4222-8222-222222222222");
const CUSTOMER_ID = CustomerId.parse("33333333-3333-4333-8333-333333333333");
const ACME_SLUG = "acme";

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startAuthApp(clock = new InMemoryClock(new Date("2026-08-23T03:00:00.000Z"))) {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  await organizations.save({ id: OrganizationId.DEFAULT, slug: ACME_SLUG });
  const staffUsers = new InMemoryStaffUserRepository();
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const sessions = new InMemorySessionStore();
  await staffUsers.save({
    id: STAFF_ID,
      organizationId: OrganizationId.DEFAULT,
    email: "staff@local.test",
    passwordHash: await passwords.hash("staff-secret"),
  });
  await wholesaleUsers.save({
    id: WHOLESALE_ID,
    organizationId: OrganizationId.DEFAULT,
    email: "wholesale@local.test",
    passwordHash: await passwords.hash("wholesale-secret"),
    customerId: CUSTOMER_ID,
  });
  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock,
    staffUsers,
    wholesaleUsers,
    sessions,
    passwords,
    organizationRepo: organizations,
  });
  apps.push(app);
  return { app, clock };
}

function cookieValue(
  res: Awaited<ReturnType<Awaited<ReturnType<typeof buildApp>>["inject"]>>,
  name: string,
) {
  return res.cookies.find((cookie) => cookie.name === name);
}

describe("opaque session HTTP", () => {
  it("sets HttpOnly staff_session on login and returns the session", async () => {
    const { app } = await startAuthApp();
    const login = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "staff@local.test",
        password: "staff-secret",
      },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json()).toEqual({
      staffUserId: STAFF_ID,
      email: "staff@local.test",
      organizationId: OrganizationId.DEFAULT,
    });
    const cookie = cookieValue(login, STAFF_SESSION_COOKIE);
    expect(cookie?.name).toBe(STAFF_SESSION_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe("/");
    expect(cookie?.sameSite).toBe("Lax");
    expect(cookie?.secure).toBeFalsy();
    expect(cookie?.domain == null || cookie.domain === "").toBe(true);

    const tlsLogin = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      headers: { "x-forwarded-proto": "https" },
      payload: {
        organizationSlug: ACME_SLUG,
        email: "staff@local.test",
        password: "staff-secret",
      },
    });
    expect(cookieValue(tlsLogin, STAFF_SESSION_COOKIE)?.secure).toBe(true);

    const session = await app.inject({
      method: "GET",
      url: "/internal/auth/session",
      cookies: { [STAFF_SESSION_COOKIE]: cookie?.value ?? "" },
    });
    expect(session.statusCode).toBe(200);
    expect(session.json()).toEqual({
      staffUserId: STAFF_ID,
      email: "staff@local.test",
      organizationId: OrganizationId.DEFAULT,
    });
  });

  it("sets wholesale_session and snapshots customerId", async () => {
    const { app } = await startAuthApp();
    const login = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "wholesale@local.test",
        password: "wholesale-secret",
      },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json()).toEqual({
      wholesaleUserId: WHOLESALE_ID,
      email: "wholesale@local.test",
      customerId: CUSTOMER_ID,
      organizationId: OrganizationId.DEFAULT,
    });
    const cookie = cookieValue(login, WHOLESALE_SESSION_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.name).toBe(WHOLESALE_SESSION_COOKIE);

    const session = await app.inject({
      method: "GET",
      url: "/wholesale/auth/session",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie?.value ?? "" },
    });
    expect(session.json()).toEqual({
      wholesaleUserId: WHOLESALE_ID,
      email: "wholesale@local.test",
      customerId: CUSTOMER_ID,
      organizationId: OrganizationId.DEFAULT,
    });
  });

  it("returns generic 401 for unknown email, missing cookie, wrong audience, and expired", async () => {
    const { app, clock } = await startAuthApp();
    const unknown = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "nobody@local.test",
        password: "staff-secret",
      },
    });
    expect(unknown.statusCode).toBe(401);
    expect(unknown.json()).toEqual({ error: "unauthorized" });

    const unknownSlug = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      payload: {
        organizationSlug: "missing",
        email: "staff@local.test",
        password: "staff-secret",
      },
    });
    expect(unknownSlug.statusCode).toBe(401);
    expect(unknownSlug.json()).toEqual({ error: "unauthorized" });

    const wrongPassword = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "staff@local.test",
        password: "nope",
      },
    });
    expect(wrongPassword.statusCode).toBe(401);
    expect(wrongPassword.json()).toEqual({ error: "unauthorized" });

    const wholesaleUnknownSlug = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: {
        organizationSlug: "missing",
        email: "wholesale@local.test",
        password: "wholesale-secret",
      },
    });
    expect(wholesaleUnknownSlug.statusCode).toBe(401);
    expect(wholesaleUnknownSlug.json()).toEqual({ error: "unauthorized" });

    const wholesaleWrongPassword = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "wholesale@local.test",
        password: "nope",
      },
    });
    expect(wholesaleWrongPassword.statusCode).toBe(401);
    expect(wholesaleWrongPassword.json()).toEqual({ error: "unauthorized" });

    const missing = await app.inject({
      method: "GET",
      url: "/internal/products",
    });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toEqual({ error: "unauthorized" });

    const wholesaleLogin = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "wholesale@local.test",
        password: "wholesale-secret",
      },
    });
    const wholesaleCookie = cookieValue(wholesaleLogin, WHOLESALE_SESSION_COOKIE);
    const wrongAudience = await app.inject({
      method: "GET",
      url: "/internal/products",
      cookies: { [WHOLESALE_SESSION_COOKIE]: wholesaleCookie?.value ?? "" },
    });
    expect(wrongAudience.statusCode).toBe(401);
    expect(wrongAudience.json()).toEqual({ error: "unauthorized" });

    const staffLogin = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "staff@local.test",
        password: "staff-secret",
      },
    });
    const staffCookie = cookieValue(staffLogin, STAFF_SESSION_COOKIE);
    clock.advance(SESSION_IDLE_MS + 1);
    const expired = await app.inject({
      method: "GET",
      url: "/internal/products",
      cookies: { [STAFF_SESSION_COOKIE]: staffCookie?.value ?? "" },
    });
    expect(expired.statusCode).toBe(401);
    expect(expired.json()).toEqual({ error: "unauthorized" });
    const cleared = cookieValue(expired, STAFF_SESSION_COOKIE);
    expect(cleared).toBeDefined();
    expect(cleared?.maxAge === 0 || cleared?.expires !== undefined).toBe(true);
  });

  it("logs out and clears the cookie; health and ready stay open", async () => {
    const { app } = await startAuthApp();
    const login = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "staff@local.test",
        password: "staff-secret",
      },
    });
    const cookie = cookieValue(login, STAFF_SESSION_COOKIE);
    const logout = await app.inject({
      method: "POST",
      url: "/internal/auth/logout",
      cookies: { [STAFF_SESSION_COOKIE]: cookie?.value ?? "" },
    });
    expect(logout.statusCode).toBe(200);
    expect(logout.json()).toEqual({ ok: true });
    const after = await app.inject({
      method: "GET",
      url: "/internal/auth/session",
      cookies: { [STAFF_SESSION_COOKIE]: cookie?.value ?? "" },
    });
    expect(after.statusCode).toBe(401);

    const health = await app.inject({ method: "GET", url: "/health" });
    const ready = await app.inject({ method: "GET", url: "/ready" });
    expect(health.statusCode).toBe(200);
    expect(ready.statusCode).toBe(200);
  });

  it("returns a stable 429 with Retry-After after repeated login failures", async () => {
    const { app } = await startAuthApp();
    const request = {
      method: "POST" as const,
      url: "/internal/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "staff@local.test",
        password: "wrong",
      },
    };

    for (let attempt = 0; attempt < LOGIN_THROTTLE_MAX_ATTEMPTS; attempt += 1) {
      const response = await app.inject(request);
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "unauthorized" });
    }
    const rejected = await app.inject(request);
    expect(rejected.statusCode).toBe(429);
    expect(rejected.headers["retry-after"]).toBe(
      (LOGIN_THROTTLE_WINDOW_MS / 1000).toString(),
    );
    expect(rejected.json()).toEqual({
      error: "too_many_login_attempts",
      retryAfterSeconds: LOGIN_THROTTLE_WINDOW_MS / 1000,
    });

    const unknownAccountRequest = {
      ...request,
      payload: { ...request.payload, email: "missing@local.test" },
    };
    for (let attempt = 0; attempt < LOGIN_THROTTLE_MAX_ATTEMPTS; attempt += 1) {
      expect((await app.inject(unknownAccountRequest)).statusCode).toBe(401);
    }
    const unknownRejected = await app.inject(unknownAccountRequest);
    expect(unknownRejected.statusCode).toBe(rejected.statusCode);
    expect(unknownRejected.headers["retry-after"]).toBe(
      rejected.headers["retry-after"],
    );
    expect(unknownRejected.json()).toEqual(rejected.json());
  });

  it("clears failed attempts after a successful login", async () => {
    const { app } = await startAuthApp();
    const payload = {
      organizationSlug: ACME_SLUG,
      email: "staff@local.test",
      password: "wrong",
    };

    for (let attempt = 1; attempt < LOGIN_THROTTLE_MAX_ATTEMPTS; attempt += 1) {
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/internal/auth/login",
            payload,
          })
        ).statusCode,
      ).toBe(401);
    }
    const success = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      payload: { ...payload, password: "staff-secret" },
    });
    expect(success.statusCode).toBe(200);

    for (let attempt = 0; attempt < LOGIN_THROTTLE_MAX_ATTEMPTS; attempt += 1) {
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/internal/auth/login",
            payload,
          })
        ).statusCode,
      ).toBe(401);
    }
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/internal/auth/login",
          payload,
        })
      ).statusCode,
    ).toBe(429);
  });

  it("allows credentialed CORS from CORS_ORIGINS and never uses *", async () => {
    const { app } = await startAuthApp();
    const allowed = await app.inject({
      method: "OPTIONS",
      url: "/internal/auth/login",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "POST",
      },
    });
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");
    expect(allowed.headers["access-control-allow-origin"]).not.toBe("*");

    const denied = await app.inject({
      method: "OPTIONS",
      url: "/internal/auth/login",
      headers: {
        origin: "https://evil.example",
        "access-control-request-method": "POST",
      },
    });
    expect(denied.headers["access-control-allow-origin"]).not.toBe(
      "https://evil.example",
    );
    expect(denied.headers["access-control-allow-origin"]).not.toBe("*");
  });

  it("does not add ops auth routes", async () => {
    const { app } = await startAuthApp();
    const opsLogin = await app.inject({
      method: "POST",
      url: "/ops/auth/login",
      payload: { organizationSlug: ACME_SLUG, email: "ops@local.test", password: "x" },
    });
    expect(opsLogin.statusCode).toBe(404);
  });
});
