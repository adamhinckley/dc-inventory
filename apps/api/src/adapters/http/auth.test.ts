import {
  CustomerId,
  Money,
  OrganizationId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { InMemoryCustomerRepository } from "@dc-inventory/customers";
import {
  InMemoryClock,
  InMemoryOrganizationRepository,
  InMemoryOpsUserRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  InMemoryWholesaleUserRepository,
  LOGIN_THROTTLE_MAX_ATTEMPTS,
  LOGIN_THROTTLE_WINDOW_MS,
  OpsUserId,
  SESSION_IDLE_MS,
} from "@dc-inventory/identity";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { readTrustProxy } from "../../infrastructure/trust-proxy.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import {
  STAFF_SESSION_COOKIE,
  OPS_SESSION_COOKIE,
  WHOLESALE_SESSION_COOKIE,
} from "./auth-cookies.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const WHOLESALE_ID = WholesaleUserId.parse("22222222-2222-4222-8222-222222222222");
const OPERATOR_ID = OpsUserId.parse("44444444-4444-4444-8444-444444444444");
const OWNER_ID = OpsUserId.parse("55555555-5555-4555-8555-555555555555");
const CUSTOMER_ID = CustomerId.parse("33333333-3333-4333-8333-333333333333");
const ACME_SLUG = "acme";

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startAuthApp(
  clock = new InMemoryClock(new Date("2026-08-23T03:00:00.000Z")),
  options: { trustProxy?: import("../../infrastructure/trust-proxy.js").TrustProxySetting } = {},
) {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  await organizations.save({ id: OrganizationId.DEFAULT, slug: ACME_SLUG, name: "Acme Wholesale" });
  const staffUsers = new InMemoryStaffUserRepository();
  const opsUsers = new InMemoryOpsUserRepository();
  const wholesaleUsers = new InMemoryWholesaleUserRepository();
  const sessions = new InMemorySessionStore();
  const customerRepo = new InMemoryCustomerRepository();
  await customerRepo.save({
    id: CUSTOMER_ID,
    organizationId: OrganizationId.DEFAULT,
    name: "Acme Wholesale",
    creditLimit: Money.fromMinorUnits(1_000_000, "USD"),
    terms: "NET30",
    createdAt: new Date("2026-08-24T03:30:00.000Z"),
  });
  await staffUsers.save({
    id: STAFF_ID,
      organizationId: OrganizationId.DEFAULT,
      displayName: "Test Staff",
    email: "staff@local.test",
    passwordHash: await passwords.hash("staff-secret"),
    roles: ["admin"],
  });
  await wholesaleUsers.save({
    id: WHOLESALE_ID,
    organizationId: OrganizationId.DEFAULT,
    displayName: "Test Wholesale User",
    email: "wholesale@local.test",
    passwordHash: await passwords.hash("wholesale-secret"),
    customerId: CUSTOMER_ID,
  });
  await opsUsers.save({
    id: OPERATOR_ID,
    tenantId: OrganizationId.DEFAULT,
    displayName: "Test Ops User",
    email: "operator@local.test",
    passwordHash: await passwords.hash("operator-secret"),
    kind: "operator",
  });
  await opsUsers.save({
    id: OWNER_ID,
    tenantId: OrganizationId.DEFAULT,
    displayName: "Test Ops User",
    email: "owner@local.test",
    passwordHash: await passwords.hash("owner-secret"),
    kind: "business_owner",
  });
  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock,
    staffUsers,
    opsUsers,
    wholesaleUsers,
    sessions,
    passwords,
    organizationRepo: organizations,
    customerRepo,
    trustProxy: options.trustProxy,
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

function setCookieHeaders(
  res: Awaited<ReturnType<Awaited<ReturnType<typeof buildApp>>["inject"]>>,
): string[] {
  const raw = res.headers["set-cookie"];
  if (raw === undefined) {
    return [];
  }
  return Array.isArray(raw) ? raw : [raw];
}

function pathFromSetCookie(header: string): string | undefined {
  const match = /Path=([^;]+)/i.exec(header);
  return match?.[1];
}

function clearedCookieHeaders(headers: string[], name: string): string[] {
  return headers.filter((header) => {
    if (!header.startsWith(`${name}=`)) {
      return false;
    }
    return /Max-Age=0|Expires=/i.test(header);
  });
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
      roles: ["admin"],
    });
    const cookie = cookieValue(login, STAFF_SESSION_COOKIE);
    expect(cookie?.name).toBe(STAFF_SESSION_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe("/internal");
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
    expect(cookieValue(tlsLogin, STAFF_SESSION_COOKIE)?.sameSite).toBe("Lax");

    const flyLogin = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      headers: {
        host: "dc-inventory-api.fly.dev",
        origin: "http://localhost:3000",
        "x-forwarded-proto": "https",
      },
      payload: {
        organizationSlug: ACME_SLUG,
        email: "staff@local.test",
        password: "staff-secret",
      },
    });
    expect(cookieValue(flyLogin, STAFF_SESSION_COOKIE)?.secure).toBe(true);
    expect(cookieValue(flyLogin, STAFF_SESSION_COOKIE)?.sameSite).toBe("Lax");

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
      roles: ["admin"],
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
      mode: "buyer",
      staffUserId: null,
      wholesaleUserId: WHOLESALE_ID,
      email: "wholesale@local.test",
      customerId: CUSTOMER_ID,
      organizationId: OrganizationId.DEFAULT,
    });
    const cookie = cookieValue(login, WHOLESALE_SESSION_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.name).toBe(WHOLESALE_SESSION_COOKIE);
    expect(cookie?.path).toBe("/wholesale");

    const session = await app.inject({
      method: "GET",
      url: "/wholesale/auth/session",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie?.value ?? "" },
    });
    expect(session.json()).toEqual({
      mode: "buyer",
      staffUserId: null,
      wholesaleUserId: WHOLESALE_ID,
      email: "wholesale@local.test",
      customerId: CUSTOMER_ID,
      organizationId: OrganizationId.DEFAULT,
    });
  });

  it("sets wholesale_session for staff acting with null customer binding", async () => {
    const { app } = await startAuthApp();
    const login = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "staff@local.test",
        password: "staff-secret",
      },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json()).toEqual({
      mode: "staff_acting",
      staffUserId: STAFF_ID,
      wholesaleUserId: null,
      email: "staff@local.test",
      customerId: null,
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
    expect(session.statusCode).toBe(200);
    expect(session.json()).toEqual({
      mode: "staff_acting",
      staffUserId: STAFF_ID,
      wholesaleUserId: null,
      email: "staff@local.test",
      customerId: null,
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
    const staffClears = clearedCookieHeaders(
      setCookieHeaders(logout),
      STAFF_SESSION_COOKIE,
    );
    expect(staffClears).toHaveLength(2);
    expect(staffClears.map(pathFromSetCookie).sort()).toEqual(["/", "/internal"]);
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

  it("clears both scoped and legacy paths on wholesale logout", async () => {
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
    const cookie = cookieValue(login, WHOLESALE_SESSION_COOKIE);
    const logout = await app.inject({
      method: "POST",
      url: "/wholesale/auth/logout",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie?.value ?? "" },
    });
    expect(logout.statusCode).toBe(200);
    const wholesaleClears = clearedCookieHeaders(
      setCookieHeaders(logout),
      WHOLESALE_SESSION_COOKIE,
    );
    expect(wholesaleClears).toHaveLength(2);
    expect(wholesaleClears.map(pathFromSetCookie).sort()).toEqual(["/", "/wholesale"]);
  });

  it("clears only legacy Path=/ for the opposite audience on login", async () => {
    const { app } = await startAuthApp();
    const staffLogin = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "staff@local.test",
        password: "staff-secret",
      },
    });
    expect(staffLogin.statusCode).toBe(200);
    const staffCookie = cookieValue(staffLogin, STAFF_SESSION_COOKIE);

    const wholesaleLogin = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "wholesale@local.test",
        password: "wholesale-secret",
      },
    });
    expect(wholesaleLogin.statusCode).toBe(200);
    const staffClearsOnWholesaleLogin = clearedCookieHeaders(
      setCookieHeaders(wholesaleLogin),
      STAFF_SESSION_COOKIE,
    );
    expect(staffClearsOnWholesaleLogin).toHaveLength(1);
    expect(pathFromSetCookie(staffClearsOnWholesaleLogin[0] ?? "")).toBe("/");

    const staffSession = await app.inject({
      method: "GET",
      url: "/internal/auth/session",
      cookies: { [STAFF_SESSION_COOKIE]: staffCookie?.value ?? "" },
    });
    expect(staffSession.statusCode).toBe(200);

    const internalLogin = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "staff@local.test",
        password: "staff-secret",
      },
    });
    expect(internalLogin.statusCode).toBe(200);
    const wholesaleCookie = cookieValue(wholesaleLogin, WHOLESALE_SESSION_COOKIE);
    const wholesaleClearsOnStaffLogin = clearedCookieHeaders(
      setCookieHeaders(internalLogin),
      WHOLESALE_SESSION_COOKIE,
    );
    expect(wholesaleClearsOnStaffLogin).toHaveLength(1);
    expect(pathFromSetCookie(wholesaleClearsOnStaffLogin[0] ?? "")).toBe("/");

    const wholesaleSession = await app.inject({
      method: "GET",
      url: "/wholesale/auth/session",
      cookies: { [WHOLESALE_SESSION_COOKIE]: wholesaleCookie?.value ?? "" },
    });
    expect(wholesaleSession.statusCode).toBe(200);
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

    const { app: unknownApp } = await startAuthApp();
    const unknownAccountRequest = {
      ...request,
      payload: { ...request.payload, email: "missing@local.test" },
    };
    for (let attempt = 0; attempt < LOGIN_THROTTLE_MAX_ATTEMPTS; attempt += 1) {
      expect((await unknownApp.inject(unknownAccountRequest)).statusCode).toBe(401);
    }
    const unknownRejected = await unknownApp.inject(unknownAccountRequest);
    expect(unknownRejected.statusCode).toBe(rejected.statusCode);
    expect(unknownRejected.headers["retry-after"]).toBe(
      rejected.headers["retry-after"],
    );
    expect(unknownRejected.json()).toEqual(rejected.json());
  });

  it("throttles distinct forwarded client addresses behind a trusted proxy", async () => {
    const { app } = await startAuthApp(undefined, { trustProxy: readTrustProxy("1") });
    const blockedClient = {
      method: "POST" as const,
      url: "/internal/auth/login",
      headers: { "x-forwarded-for": "203.0.113.10" },
      payload: {
        organizationSlug: ACME_SLUG,
        email: "staff@local.test",
        password: "wrong",
      },
    };

    for (let attempt = 0; attempt <= LOGIN_THROTTLE_MAX_ATTEMPTS; attempt += 1) {
      const response = await app.inject(blockedClient);
      expect([401, 429]).toContain(response.statusCode);
    }
    const blocked = await app.inject(blockedClient);
    expect(blocked.statusCode).toBe(429);

    const otherClient = await app.inject({
      ...blockedClient,
      headers: { "x-forwarded-for": "203.0.113.11" },
      payload: {
        ...blockedClient.payload,
        email: "other@local.test",
      },
    });
    expect(otherClient.statusCode).toBe(401);
  });

  it("ignores prepended X-Forwarded-For addresses when TRUST_PROXY is one hop", async () => {
    const { app } = await startAuthApp(undefined, { trustProxy: readTrustProxy("1") });
    const payload = {
      organizationSlug: ACME_SLUG,
      email: "staff@local.test",
      password: "wrong",
    };

    for (let attempt = 0; attempt <= LOGIN_THROTTLE_MAX_ATTEMPTS; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/internal/auth/login",
        headers: { "x-forwarded-for": "203.0.113.10" },
        payload,
      });
      expect([401, 429]).toContain(response.statusCode);
    }

    const spoofed = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      headers: { "x-forwarded-for": "198.51.100.99, 203.0.113.10" },
      payload,
    });
    expect(spoofed.statusCode).toBe(429);

    const otherIp = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      headers: { "x-forwarded-for": "203.0.113.11" },
      payload: { ...payload, email: "other@local.test" },
    });
    expect(otherIp.statusCode).toBe(401);
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

    const patchPreflight = await app.inject({
      method: "OPTIONS",
      url: "/internal/purchase-orders/00000000-0000-4000-8000-000000000001",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "PATCH",
        "access-control-request-headers": "content-type",
      },
    });
    expect(patchPreflight.statusCode).toBe(204);
    const allowedMethods = String(
      patchPreflight.headers["access-control-allow-methods"] ?? "",
    );
    expect(allowedMethods.split(",").map((m) => m.trim())).toEqual(
      expect.arrayContaining(["PATCH"]),
    );

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

  it.each([
    ["operator@local.test", "operator-secret", OPERATOR_ID, "operator"],
    ["owner@local.test", "owner-secret", OWNER_ID, "business_owner"],
  ] as const)(
    "sets ops_session and resolves the %s actor kind",
    async (email, password, opsUserId, kind) => {
      const { app } = await startAuthApp();
      const login = await app.inject({
        method: "POST",
        url: "/ops/auth/login",
        payload: { organizationSlug: ACME_SLUG, email, password },
      });
      expect(login.statusCode).toBe(200);
      expect(login.json()).toEqual({
        opsUserId,
        email,
        kind,
        tenantId: OrganizationId.DEFAULT,
      });
      const cookie = cookieValue(login, OPS_SESSION_COOKIE);
      expect(cookie?.name).toBe(OPS_SESSION_COOKIE);
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.path).toBe("/ops");

      const session = await app.inject({
        method: "GET",
        url: "/ops/auth/session",
        cookies: { [OPS_SESSION_COOKIE]: cookie?.value ?? "" },
      });
      expect(session.statusCode).toBe(200);
      expect(session.json()).toEqual(login.json());

      const subscription = await app.inject({
        method: "GET",
        url: "/ops/subscription",
        cookies: { [OPS_SESSION_COOKIE]: cookie?.value ?? "" },
      });
      expect(subscription.statusCode).toBe(200);
    },
  );

  it("guards every non-login ops route and expires ops sessions", async () => {
    const { app, clock } = await startAuthApp();
    for (const request of [
      { method: "GET" as const, url: "/ops/subscription" },
      { method: "GET" as const, url: "/ops/auth/session" },
      { method: "POST" as const, url: "/ops/auth/logout" },
    ]) {
      const response = await app.inject(request);
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "unauthorized" });
    }

    const login = await app.inject({
      method: "POST",
      url: "/ops/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "operator@local.test",
        password: "operator-secret",
      },
    });
    const cookie = cookieValue(login, OPS_SESSION_COOKIE);
    clock.advance(SESSION_IDLE_MS + 1);
    const expired = await app.inject({
      method: "GET",
      url: "/ops/subscription",
      cookies: { [OPS_SESSION_COOKIE]: cookie?.value ?? "" },
    });
    expect(expired.statusCode).toBe(401);
    expect(expired.json()).toEqual({ error: "unauthorized" });
  });

  it("rejects staff and wholesale cookies and wrong-audience tokens on ops routes", async () => {
    const { app } = await startAuthApp();
    const staffLogin = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "staff@local.test",
        password: "staff-secret",
      },
    });
    const wholesaleLogin = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "wholesale@local.test",
        password: "wholesale-secret",
      },
    });
    const staffToken = cookieValue(staffLogin, STAFF_SESSION_COOKIE)?.value ?? "";
    const wholesaleToken =
      cookieValue(wholesaleLogin, WHOLESALE_SESSION_COOKIE)?.value ?? "";

    for (const cookies of [
      { [STAFF_SESSION_COOKIE]: staffToken },
      { [WHOLESALE_SESSION_COOKIE]: wholesaleToken },
      { [OPS_SESSION_COOKIE]: staffToken },
      { [OPS_SESSION_COOKIE]: wholesaleToken },
    ]) {
      const response = await app.inject({
        method: "GET",
        url: "/ops/subscription",
        cookies,
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "unauthorized" });
    }
  });

  it("throttles ops login with the shared interface", async () => {
    const { app } = await startAuthApp();
    const request = {
      method: "POST" as const,
      url: "/ops/auth/login",
      payload: {
        organizationSlug: ACME_SLUG,
        email: "ops@local.test",
        password: "wrong",
      },
    };

    for (let attempt = 0; attempt < LOGIN_THROTTLE_MAX_ATTEMPTS; attempt += 1) {
      expect((await app.inject(request)).statusCode).toBe(401);
    }
    const rejected = await app.inject(request);
    expect(rejected.statusCode).toBe(429);
    expect(rejected.json()).toEqual({
      error: "too_many_login_attempts",
      retryAfterSeconds: LOGIN_THROTTLE_WINDOW_MS / 1000,
    });
  });
});
