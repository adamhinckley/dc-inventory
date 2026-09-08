import {
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
} from "@dc-inventory/identity";
import type { FeatureName, IFeatures } from "@dc-inventory/licensing";
import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryDatabase } from "../in-memory-database.js";
import { buildApp } from "../../app.js";
import { STAFF_SESSION_COOKIE } from "./auth-cookies.js";

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

class DisabledFeature implements IFeatures {
  constructor(private readonly disabled: FeatureName) {}

  async isEnabled(_organizationId: OrganizationId, name: FeatureName): Promise<boolean> {
    return name !== this.disabled;
  }
}

async function authenticatedApp(disabled: FeatureName) {
  const organizations = new InMemoryOrganizationRepository();
  const staffUsers = new InMemoryStaffUserRepository();
  const sessions = new InMemorySessionStore();
  const passwords = new InMemoryPasswordHasher();
  await organizations.save({ id: OrganizationId.DEFAULT, slug: "default" });
  await staffUsers.save({
    id: StaffUserId.parse("11111111-1111-4111-8111-111111111111"),
    organizationId: OrganizationId.DEFAULT,
    email: "staff@example.test",
    passwordHash: await passwords.hash("secret"),
    roles: ["admin"],
  });
  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    organizationRepo: organizations,
    staffUsers,
    sessions,
    passwords,
    features: new DisabledFeature(disabled),
  });
  apps.push(app);
  const login = await app.inject({
    method: "POST",
    url: "/internal/auth/login",
    payload: {
      organizationSlug: "default",
      email: "staff@example.test",
      password: "secret",
    },
  });
  const session = login.cookies.find((cookie) => cookie.name === STAFF_SESSION_COOKIE)?.value;
  if (!session) {
    throw new Error("expected staff login");
  }
  return { app, session };
}

describe("named feature gates", () => {
  const cases: Array<{
    feature: FeatureName;
    url: string;
    method?: "GET" | "POST";
    payload?: Record<string, unknown>;
  }> = [
    { feature: "catalog", url: "/internal/products" },
    { feature: "inventory", url: "/internal/products" },
    { feature: "customers", url: "/internal/customers" },
    { feature: "purchasing", url: "/internal/purchase-orders" },
    {
      feature: "purchasing",
      url: "/internal/uncovered-skus/draft-purchase-orders",
      method: "POST",
    },
    {
      feature: "inventory",
      url: "/internal/inventory/reopen-skus",
      method: "POST",
      payload: {
        name: "Gate test",
        skus: ["UNCOVERED-HTTP-1"],
        windowClosesAt: "2026-08-01T00:00:00.000Z",
      },
    },
    { feature: "sales", url: "/internal/sales-orders" },
    {
      feature: "ar",
      url: "/internal/invoices/11111111-1111-4111-8111-111111111111",
    },
  ];

  it.each(cases)("returns 403 when $feature is disabled", async ({ feature, url, method = "GET", payload }) => {
    const { app, session } = await authenticatedApp(feature);

    const response = await app.inject({
      method,
      url,
      cookies: { [STAFF_SESSION_COOKIE]: session },
      ...(method === "POST"
        ? { payload: payload ?? { skus: ["UNCOVERED-HTTP-1"] } }
        : {}),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "feature_disabled" });
  });
});
