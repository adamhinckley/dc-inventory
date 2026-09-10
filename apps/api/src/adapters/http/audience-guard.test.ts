import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerStaffAudienceGuard } from "./audience-guard.js";
import { STAFF_SESSION_COOKIE } from "./auth-cookies.js";

const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440001");
const SESSION_TOKEN = "550e8400-e29b-41d4-a716-446655440099";

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function staffGuardApp(resolveStaff = vi.fn()) {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  app.decorate("identity", {
    resolveStaff: { execute: resolveStaff },
  });
  registerStaffAudienceGuard(app);
  app.get("/internal/protected", async (request) => ({
    email: request.staffAuth?.email ?? null,
  }));
  apps.push(app);
  return app;
}

describe("registerStaffAudienceGuard", () => {
  it("resolves the staff session once per request", async () => {
    const resolveStaff = vi.fn().mockResolvedValue({
      ok: true,
      staffUserId: STAFF_ID,
      email: "staff@local.test",
      organizationId: OrganizationId.DEFAULT,
      roles: ["admin"],
    });
    const app = await staffGuardApp(resolveStaff);

    const response = await app.inject({
      method: "GET",
      url: "/internal/protected",
      cookies: { [STAFF_SESSION_COOKIE]: SESSION_TOKEN },
    });

    expect(response.statusCode).toBe(200);
    expect(resolveStaff).toHaveBeenCalledTimes(1);
    expect(resolveStaff).toHaveBeenCalledWith(SESSION_TOKEN);
  });

  it("skips resolve when staffAuth is already set on the request", async () => {
    const resolveStaff = vi.fn().mockResolvedValue({
      ok: true,
      staffUserId: STAFF_ID,
      email: "staff@local.test",
      organizationId: OrganizationId.DEFAULT,
      roles: ["admin"],
    });
    const app = Fastify({ logger: false });
    await app.register(cookie);
    app.decorate("identity", {
      resolveStaff: { execute: resolveStaff },
    });
    app.addHook("preHandler", async (request) => {
      request.staffAuth = {
        staffUserId: STAFF_ID,
        email: "memoized@local.test",
        organizationId: OrganizationId.DEFAULT,
        roles: ["admin"],
      };
    });
    registerStaffAudienceGuard(app);
    app.get("/internal/protected", async (request) => ({
      email: request.staffAuth?.email ?? null,
    }));
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/internal/protected",
      cookies: { [STAFF_SESSION_COOKIE]: SESSION_TOKEN },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ email: "memoized@local.test" });
    expect(resolveStaff).not.toHaveBeenCalled();
  });
});
