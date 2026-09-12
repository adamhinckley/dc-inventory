import {
  InMemoryClock,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
} from "@dc-inventory/identity";
import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { STAFF_SESSION_COOKIE } from "./auth-cookies.js";
import { loginBody } from "./test-login.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startSuppliersApp() {
  const passwords = new InMemoryPasswordHasher();
  const organizations = new InMemoryOrganizationRepository();
  await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme", name: "Acme Wholesale" });
  const staffUsers = new InMemoryStaffUserRepository();
  const sessions = new InMemorySessionStore();
  await staffUsers.save({
    id: STAFF_ID,
    organizationId: OrganizationId.DEFAULT,
    displayName: "Test Staff",
    email: "staff@local.test",
    passwordHash: await passwords.hash("staff-secret"),
    roles: ["admin"],
  });
  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock: new InMemoryClock(new Date("2026-08-28T02:00:00.000Z")),
    staffUsers,
    sessions,
    passwords,
    organizationRepo: organizations,
  });
  apps.push(app);
  return app;
}

async function staffCookie(app: Awaited<ReturnType<typeof buildApp>>) {
  const login = await app.inject({
    method: "POST",
    url: "/internal/auth/login",
    payload: loginBody("staff@local.test", "staff-secret"),
  });
  const cookie = login.cookies.find((row) => row.name === STAFF_SESSION_COOKIE);
  return cookie?.value ?? "";
}

describe("internal suppliers HTTP", () => {
  it("requires staff_session on suppliers list and CRUD", async () => {
    const app = await startSuppliersApp();
    const missing = await app.inject({ method: "GET", url: "/internal/suppliers" });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toEqual({ error: "unauthorized" });

    const cookie = await staffCookie(app);
    const listed = await app.inject({
      method: "GET",
      url: "/internal/suppliers",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual({ items: [], page: 1, pageSize: 25, total: 0 });
  });

  it("creates, gets, patches, and lists suppliers with duplicate vendor number guard", async () => {
    const app = await startSuppliersApp();
    const cookie = await staffCookie(app);

    const created = await app.inject({
      method: "POST",
      url: "/internal/suppliers",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { name: "Acme Supply", vendorNumber: "VEND-001" },
    });
    expect(created.statusCode).toBe(201);
    const supplier = created.json() as { id: string; name: string; vendorNumber: string };
    expect(supplier).toMatchObject({ name: "Acme Supply", vendorNumber: "VEND-001" });

    const duplicate = await app.inject({
      method: "POST",
      url: "/internal/suppliers",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { name: "Other", vendorNumber: "VEND-001" },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toEqual({ error: "duplicate_vendor_number" });

    const got = await app.inject({
      method: "GET",
      url: `/internal/suppliers/${supplier.id}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(got.statusCode).toBe(200);
    expect(got.json()).toEqual(supplier);

    const patched = await app.inject({
      method: "PATCH",
      url: `/internal/suppliers/${supplier.id}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { name: "Acme Supply Co" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({
      id: supplier.id,
      name: "Acme Supply Co",
      vendorNumber: "VEND-001",
    });

    const listed = await app.inject({
      method: "GET",
      url: "/internal/suppliers?q=acme",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({ total: 1, items: [{ id: supplier.id }] });
  });

  it("creates and patches suppliers with poPrefix and rejects duplicates", async () => {
    const app = await startSuppliersApp();
    const cookie = await staffCookie(app);

    const created = await app.inject({
      method: "POST",
      url: "/internal/suppliers",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { name: "Heritage Fabrics", vendorNumber: "HF-100", poPrefix: "HF" },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      name: "Heritage Fabrics",
      vendorNumber: "HF-100",
      poPrefix: "HF",
    });

    const duplicate = await app.inject({
      method: "POST",
      url: "/internal/suppliers",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { name: "Other", vendorNumber: "HF-200", poPrefix: "HF" },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toEqual({ error: "duplicate_po_prefix" });

    const supplier = created.json() as { id: string };
    const cleared = await app.inject({
      method: "PATCH",
      url: `/internal/suppliers/${supplier.id}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { poPrefix: null },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json()).toMatchObject({ poPrefix: null });
  });
});
