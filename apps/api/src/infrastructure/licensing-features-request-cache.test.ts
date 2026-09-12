import {
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
} from "@dc-inventory/identity";
import { InMemoryLicensingStore, LicensingFeatures } from "@dc-inventory/licensing";
import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryDatabase } from "../adapters/in-memory-database.js";
import { buildApp } from "../app.js";
import { STAFF_SESSION_COOKIE } from "../adapters/http/auth-cookies.js";

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function authenticatedLicensingApp(store: InMemoryLicensingStore) {
  const organizations = new InMemoryOrganizationRepository();
  const staffUsers = new InMemoryStaffUserRepository();
  const sessions = new InMemorySessionStore();
  const passwords = new InMemoryPasswordHasher();
  await organizations.save({ id: OrganizationId.DEFAULT, slug: "default", name: "Acme Wholesale" });
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
    licensingStore: store,
    features: new LicensingFeatures(store),
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

describe("licensing feature-state request cache", () => {
  it("scopes feature-state reads per HTTP request under concurrent load", async () => {
    const store = new InMemoryLicensingStore();
    store.createSubscription(OrganizationId.DEFAULT, "core", "active");
    const getFeatureState = vi.spyOn(store, "getFeatureState");
    const { app, session } = await authenticatedLicensingApp(store);

    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        app.inject({
          method: "GET",
          url: "/internal/products",
          cookies: { [STAFF_SESSION_COOKIE]: session },
        }),
      ),
    );

    for (const response of responses) {
      expect(response.statusCode).toBe(200);
    }
    expect(getFeatureState).toHaveBeenCalledTimes(4);
  });
});
