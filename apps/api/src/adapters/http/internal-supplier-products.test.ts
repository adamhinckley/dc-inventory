import {
  CreateProductUseCase,
  InMemoryProductRepository,
  InMemoryQtyReadPort,
} from "@dc-inventory/catalog";
import {
  InMemoryClock,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
} from "@dc-inventory/identity";
import {
  InMemorySupplierProductRepository,
  InMemorySupplierRepository,
} from "@dc-inventory/purchasing";
import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { catalogSkuLookupPort, supplierProductQtyReadPort } from "../purchasing-catalog-ports.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { STAFF_SESSION_COOKIE } from "./auth-cookies.js";
import { loginBody } from "./test-login.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startSupplierProductsApp() {
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
  const productRepo = new InMemoryProductRepository();
  const createProduct = new CreateProductUseCase(productRepo);
  const created = await createProduct.execute({
    organizationId: OrganizationId.DEFAULT,
    staffUserId: STAFF_ID,
    sku: "WIDGET-1",
    name: "Blue Widget",
    uom: "EA",
    memberPriceCents: 1000,
    taxCategoryCode: "P0000000",
  });
  if (!created.ok) {
    throw new Error("expected product");
  }
  const qtyRead = new InMemoryQtyReadPort();
  qtyRead.set(OrganizationId.DEFAULT, "WIDGET-1", {
    onHand: 12,
    onOrder: 3,
    allocated: 1,
    available: 11,
  });
  const supplierRepo = new InMemorySupplierRepository();
  const supplierProductRepo = new InMemorySupplierProductRepository();
  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock: new InMemoryClock(new Date("2026-08-28T02:00:00.000Z")),
    staffUsers,
    sessions,
    passwords,
    organizationRepo: organizations,
    productRepo,
    qtyRead,
    supplierRepo,
    supplierProductRepo,
    catalogSkuLookup: catalogSkuLookupPort(productRepo),
    supplierProductQtyRead: supplierProductQtyReadPort(qtyRead),
  });
  apps.push(app);
  return { app, supplierRepo };
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

describe("internal supplier products HTTP", () => {
  it("requires staff_session on supplier product routes", async () => {
    const { app } = await startSupplierProductsApp();
    const missing = await app.inject({
      method: "GET",
      url: "/internal/suppliers/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/products",
    });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toEqual({ error: "unauthorized" });
  });

  it("assigns, lists with hydration, updates, unlinks, and guards unknown/duplicate SKU", async () => {
    const { app, supplierRepo } = await startSupplierProductsApp();
    const cookie = await staffCookie(app);

    const supplierRes = await app.inject({
      method: "POST",
      url: "/internal/suppliers",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { name: "Acme Supply", vendorNumber: "VEND-001" },
    });
    const supplier = supplierRes.json() as { id: string };

    const unknown = await app.inject({
      method: "POST",
      url: `/internal/suppliers/${supplier.id}/products`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { sku: "MISSING-SKU" },
    });
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json()).toEqual({ error: "unknown_sku" });

    const assigned = await app.inject({
      method: "POST",
      url: `/internal/suppliers/${supplier.id}/products`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        sku: "WIDGET-1",
        supplierSku: "ACME-W1",
        minOrderQty: 6,
        lastPoCostCents: 450,
      },
    });
    expect(assigned.statusCode).toBe(201);
    const product = assigned.json() as { id: string; sku: string; supplierSku: string };
    expect(product).toMatchObject({ sku: "WIDGET-1", supplierSku: "ACME-W1" });

    const duplicate = await app.inject({
      method: "POST",
      url: `/internal/suppliers/${supplier.id}/products`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { sku: "WIDGET-1" },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toEqual({ error: "duplicate_sku" });

    const listed = await app.inject({
      method: "GET",
      url: `/internal/suppliers/${supplier.id}/products`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({
      total: 1,
      items: [
        {
          id: product.id,
          sku: "WIDGET-1",
          catalogName: "Blue Widget",
          supplierSku: "ACME-W1",
          qty: { onHand: 12, onOrder: 3, allocated: 1, available: 11 },
        },
      ],
    });

    const patched = await app.inject({
      method: "PATCH",
      url: `/internal/suppliers/${supplier.id}/products/${product.id}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { supplierSku: "ACME-W1-NEW", lastPoCostCents: 500 },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({
      id: product.id,
      supplierSku: "ACME-W1-NEW",
      lastPoCostCents: 500,
    });

    const unlinked = await app.inject({
      method: "DELETE",
      url: `/internal/suppliers/${supplier.id}/products/${product.id}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(unlinked.statusCode).toBe(204);

    const empty = await app.inject({
      method: "GET",
      url: `/internal/suppliers/${supplier.id}/products`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(empty.json()).toMatchObject({ total: 0, items: [] });

    void supplierRepo;
  });
});
