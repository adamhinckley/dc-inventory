import {
  InMemoryProductRepository,
  InMemoryQtyReadPort,
} from "@dc-inventory/catalog";
import {
  InMemoryCustomerRepository,
  InMemoryExemptionCertificateRepository,
  InMemoryShipToRepository,
} from "@dc-inventory/customers";
import {
  InMemoryClock,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  InMemoryWholesaleUserRepository,
} from "@dc-inventory/identity";
import {
  PHASE2_DEFAULT_LOCATION_CODE,
  PHASE2_SUPPLIER_NAME,
  PHASE2_SUPPLIER_VENDOR_NUMBER,
} from "@dc-inventory/inventory";
import { InMemorySupplierRepository } from "@dc-inventory/purchasing";
import { OrganizationId, SupplierId } from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { InMemoryDatabase } from "../adapters/in-memory-database.js";
import { WHOLESALE_SESSION_COOKIE } from "../adapters/http/auth-cookies.js";
import { DEFAULT_DEMO_SEED } from "./planner/constants.js";
import { planDemoBook } from "./planner/plan-demo-book.js";
import {
  PHASE1_CUSTOMER_NAME,
  PHASE1_NORTHSTAR_WHOLESALE_EMAIL,
  PHASE1_ORGANIZATION_SLUG,
  PHASE1_STAFF_EMAIL,
  PHASE1_WHOLESALE_EMAIL,
} from "./phase1-fixture.js";
import { DEMO_NAMED_CUSTOMERS } from "./reconciliation/expectations.js";
import { InMemoryProductImageSeedRepository } from "./ports/in-memory-product-image-seed.js";
import { InMemorySupplierProductSeedRepository } from "./ports/in-memory-supplier-product-seed.js";
import type { StaticDemoSeedPorts } from "./ports/static-seed-types.js";
import { runWriteStaticDemoBook } from "./write-static-demo-book.js";

const SEED_TODAY = new Date("2026-08-24T15:30:00.000Z");
const STAFF_PASSWORD = "phase1-staff-placeholder";
const WHOLESALE_PASSWORD = "phase1-wholesale-placeholder";

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function staticSeedPorts(): StaticDemoSeedPorts & {
  locations: Map<string, { id: string; code: string }>;
} {
  const suppliers = new InMemorySupplierRepository();
  const locations = new Map<string, { id: string; code: string }>();
  let locationSeq = 0;

  return {
    products: new InMemoryProductRepository(),
    productImages: new InMemoryProductImageSeedRepository(),
    customers: new InMemoryCustomerRepository(),
    shipTos: new InMemoryShipToRepository(),
    exemptionCertificates: new InMemoryExemptionCertificateRepository(),
    organizations: new InMemoryOrganizationRepository(),
    staffUsers: new InMemoryStaffUserRepository(),
    wholesaleUsers: new InMemoryWholesaleUserRepository(),
    passwords: new InMemoryPasswordHasher(),
    suppliers,
    supplierProducts: new InMemorySupplierProductSeedRepository(),
    locations,
    phase2Bootstrap: {
      async upsertDefaultLocation() {
        const existing = locations.get(PHASE2_DEFAULT_LOCATION_CODE);
        if (existing) {
          return existing;
        }
        const row = {
          id: `loc-${String(++locationSeq)}`,
          code: PHASE2_DEFAULT_LOCATION_CODE,
        };
        locations.set(PHASE2_DEFAULT_LOCATION_CODE, row);
        return row;
      },
      async upsertPrerequisiteSupplier() {
        const existing = await suppliers.findByVendorNumber(
          OrganizationId.DEFAULT,
          PHASE2_SUPPLIER_VENDOR_NUMBER,
        );
        if (existing) {
          return { id: existing.id, vendorNumber: existing.vendorNumber };
        }
        const id = SupplierId.parse(crypto.randomUUID());
        await suppliers.save({
          id,
          organizationId: OrganizationId.DEFAULT,
          vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER,
          name: PHASE2_SUPPLIER_NAME,
          poPrefix: null,
        });
        return { id, vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER };
      },
    },
  };
}

function wholesaleCookie(
  res: Awaited<ReturnType<Awaited<ReturnType<typeof buildApp>>["inject"]>>,
) {
  return res.cookies.find((cookie) => cookie.name === WHOLESALE_SESSION_COOKIE)?.value ?? "";
}

describe("demo seed wholesale staff acting HTTP", () => {
  it("lets seeded staff act for Acme through catalog and sales orders", async () => {
    const ports = staticSeedPorts();
    const sessions = new InMemorySessionStore();
    const plan = planDemoBook({ seed: DEFAULT_DEMO_SEED, seedToday: SEED_TODAY });
    const seeded = await runWriteStaticDemoBook(ports, plan, {
      staffPassword: STAFF_PASSWORD,
      wholesalePassword: WHOLESALE_PASSWORD,
    });

    const acme = seeded.customers.find((row) => row.name === PHASE1_CUSTOMER_NAME);
    const northstar = seeded.customers.find(
      (row) => row.name === DEMO_NAMED_CUSTOMERS.northstar.name,
    );
    expect(acme).toBeDefined();
    expect(northstar).toBeDefined();

    const northstarWholesale = await ports.wholesaleUsers.findByEmail(
      OrganizationId.DEFAULT,
      PHASE1_NORTHSTAR_WHOLESALE_EMAIL,
    );
    expect(northstarWholesale?.customerId).toBe(northstar?.id);

    const app = await buildApp({
      logger: false,
      database: new InMemoryDatabase(),
      clock: new InMemoryClock(SEED_TODAY),
      staffUsers: ports.staffUsers,
      wholesaleUsers: ports.wholesaleUsers,
      sessions,
      passwords: ports.passwords,
      organizationRepo: ports.organizations,
      customerRepo: ports.customers,
      productRepo: ports.products,
      qtyRead: new InMemoryQtyReadPort(),
    });
    apps.push(app);

    const staffLogin = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: {
        organizationSlug: PHASE1_ORGANIZATION_SLUG,
        email: PHASE1_STAFF_EMAIL,
        password: STAFF_PASSWORD,
      },
    });
    expect(staffLogin.statusCode).toBe(200);
    expect(staffLogin.json()).toMatchObject({
      mode: "staff_acting",
      email: PHASE1_STAFF_EMAIL,
      customerId: null,
    });
    const cookie = wholesaleCookie(staffLogin);

    const customers = await app.inject({
      method: "GET",
      url: "/wholesale/auth/customers",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(customers.statusCode).toBe(200);
    const customerIds = customers.json().items.map((row: { customerId: string }) => row.customerId);
    expect(customerIds).toContain(acme?.id);
    expect(customerIds).toContain(northstar?.id);

    const selectAcme = await app.inject({
      method: "POST",
      url: "/wholesale/auth/select-customer",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: { customerId: acme?.id },
    });
    expect(selectAcme.statusCode).toBe(200);

    const catalog = await app.inject({
      method: "GET",
      url: "/wholesale/catalog?availableOnly=false",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(catalog.statusCode).toBe(200);
    expect(catalog.json().total).toBeGreaterThan(0);
    const productId = catalog.json().items[0].id as string;

    const order = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
      payload: {
        lines: [{ productId, qty: 1 }],
      },
    });
    expect(order.statusCode).toBe(201);
    const orderId = order.json().id as string;

    const fetched = await app.inject({
      method: "GET",
      url: `/wholesale/sales-orders/${orderId}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: cookie },
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json()).toMatchObject({
      id: orderId,
      customerId: acme?.id,
      status: "draft",
    });

    const wholesaleLogin = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: {
        organizationSlug: PHASE1_ORGANIZATION_SLUG,
        email: PHASE1_WHOLESALE_EMAIL,
        password: WHOLESALE_PASSWORD,
      },
    });
    expect(wholesaleLogin.statusCode).toBe(200);
    const wholesaleCookieValue = wholesaleCookie(wholesaleLogin);

    const northstarOrder = await app.inject({
      method: "POST",
      url: "/wholesale/auth/login",
      payload: {
        organizationSlug: PHASE1_ORGANIZATION_SLUG,
        email: PHASE1_NORTHSTAR_WHOLESALE_EMAIL,
        password: WHOLESALE_PASSWORD,
      },
    });
    expect(northstarOrder.statusCode).toBe(200);
    const northstarCookie = wholesaleCookie(northstarOrder);

    const northstarDraft = await app.inject({
      method: "POST",
      url: "/wholesale/sales-orders",
      cookies: { [WHOLESALE_SESSION_COOKIE]: northstarCookie },
      payload: {
        lines: [{ productId, qty: 1 }],
      },
    });
    expect(northstarDraft.statusCode).toBe(201);
    const northstarOrderId = northstarDraft.json().id as string;

    const forbidden = await app.inject({
      method: "GET",
      url: `/wholesale/sales-orders/${northstarOrderId}`,
      cookies: { [WHOLESALE_SESSION_COOKIE]: wholesaleCookieValue },
    });
    expect(forbidden.statusCode).toBe(404);
    expect(forbidden.json()).toEqual({ error: "not_found" });
  });
});
