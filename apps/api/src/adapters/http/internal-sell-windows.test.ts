import {
  CreateSellWindowUseCase,
  InMemoryClock,
  InMemorySellWindowRepository,
} from "@dc-inventory/inventory";
import {
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
} from "@dc-inventory/identity";
import { OrganizationId, Sku, StaffUserId } from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { STAFF_SESSION_COOKIE } from "./auth-cookies.js";
import { loginBody } from "./test-login.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const SKU_A = Sku.parse("SELLWIN-HTTP-A");
const SKU_B = Sku.parse("SELLWIN-HTTP-B");
const OPENS = "2026-07-01T00:00:00.000Z";
const CLOSES = "2026-08-01T00:00:00.000Z";
const NOW = new Date("2026-07-15T12:00:00.000Z");

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startSellWindowApp() {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme" });
  const staffUsers = new InMemoryStaffUserRepository();
  const sessions = new InMemorySessionStore();
  await staffUsers.save({
    id: STAFF_ID,
    organizationId: OrganizationId.DEFAULT,
    email: "staff@local.test",
    passwordHash: await passwords.hash("staff-secret"),
    roles: ["admin"],
  });

  const sellWindowRepo = new InMemorySellWindowRepository();
  const clock = new InMemoryClock(NOW);
  const createSellWindow = new CreateSellWindowUseCase(sellWindowRepo, clock);
  const created = await createSellWindow.execute({
    organizationId: OrganizationId.DEFAULT,
    staffUserId: STAFF_ID,
    name: "HTTP sell window",
    filterSnapshot: { q: "SELLWIN" },
    windowOpensAt: new Date(OPENS),
    windowClosesAt: new Date(CLOSES),
    skus: [SKU_A, SKU_B],
  });
  if (!created.ok) {
    throw new Error("expected seeded sell window");
  }

  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock,
    staffUsers,
    sessions,
    passwords,
    organizationRepo: organizations,
    sellWindowRepo,
  });
  apps.push(app);
  return { app, windowId: created.window.id };
}

async function staffCookie(app: Awaited<ReturnType<typeof buildApp>>) {
  const login = await app.inject({
    method: "POST",
    url: "/internal/auth/login",
    payload: loginBody("staff@local.test", "staff-secret"),
  });
  const session = login.cookies.find((cookie) => cookie.name === STAFF_SESSION_COOKIE)?.value;
  if (!session) {
    throw new Error("expected staff session");
  }
  return session;
}

describe("GET /internal/inventory/sell-windows", () => {
  it("requires staff auth", async () => {
    const { app } = await startSellWindowApp();
    const response = await app.inject({
      method: "GET",
      url: "/internal/inventory/sell-windows",
    });
    expect(response.statusCode).toBe(401);
  });

  it("returns paginated sell windows", async () => {
    const { app } = await startSellWindowApp();
    const session = await staffCookie(app);

    const list = await app.inject({
      method: "GET",
      url: "/internal/inventory/sell-windows",
      headers: { cookie: `${STAFF_SESSION_COOKIE}=${session}` },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json();
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      name: "HTTP sell window",
      status: "open",
      skuCount: 2,
      filterSnapshot: { q: "SELLWIN" },
      windowOpensAt: OPENS,
      windowClosesAt: CLOSES,
      manuallyClosedAt: null,
      appliedBy: STAFF_ID,
    });
  });
});

describe("GET /internal/inventory/sell-windows/:id", () => {
  it("returns one sell window with sku membership", async () => {
    const { app, windowId } = await startSellWindowApp();
    const session = await staffCookie(app);

    const detail = await app.inject({
      method: "GET",
      url: `/internal/inventory/sell-windows/${windowId}`,
      headers: { cookie: `${STAFF_SESSION_COOKIE}=${session}` },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      id: windowId,
      name: "HTTP sell window",
      skus: [SKU_A.value, SKU_B.value],
    });
  });

  it("returns 404 for unknown windows", async () => {
    const { app } = await startSellWindowApp();
    const session = await staffCookie(app);

    const detail = await app.inject({
      method: "GET",
      url: "/internal/inventory/sell-windows/22222222-2222-4222-8222-222222222222",
      headers: { cookie: `${STAFF_SESSION_COOKIE}=${session}` },
    });
    expect(detail.statusCode).toBe(404);
    expect(detail.json()).toEqual({ error: "not_found" });
  });
});
