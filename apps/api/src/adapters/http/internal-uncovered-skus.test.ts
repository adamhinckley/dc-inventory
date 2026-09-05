import {
  CreateProductUseCase,
  InMemoryProductPackagingRepository,
  InMemoryProductRepository,
} from "@dc-inventory/catalog";
import {
  InMemoryClock,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
} from "@dc-inventory/identity";
import {
  InMemoryUncoveredReorderPolicyReadPort,
} from "@dc-inventory/inventory";
import { LocationId, OrganizationId, Sku, StaffUserId } from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { InMemoryUnitOfWork } from "../in-memory-unit-of-work.js";
import { STAFF_SESSION_COOKIE } from "./auth-cookies.js";
import { loginBody } from "./test-login.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const SKU = Sku.parse("UNCOVERED-HTTP-1");

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startUncoveredApp() {
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
  const packagingRepo = new InMemoryProductPackagingRepository();
  const createProduct = new CreateProductUseCase(productRepo);
  const created = await createProduct.execute({
    organizationId: OrganizationId.DEFAULT,
    staffUserId: STAFF_ID,
    sku: SKU.value,
    name: "Uncovered widget",
    uom: "EA",
    memberPriceCents: 1000,
    taxCategoryCode: "P0000000",
  });
  if (!created.ok) {
    throw new Error("expected product");
  }
  await packagingRepo.save({
    productId: created.product.id,
    caseQty: 48,
    caseLength: null,
    caseWidth: null,
    caseHeight: null,
  });

  const unitOfWork = new InMemoryUnitOfWork(
    {
      getBillToSnapshot: async () => null,
    },
    {
      getTerms: async () => "NET30",
    },
    new InMemoryClock(new Date("2026-08-28T02:00:00.000Z")),
  );
  const committed = await unitOfWork.inventory.ledger.recordCommitted({
    organizationId: OrganizationId.DEFAULT,
    idempotencyKey: "uncovered-http-commit",
    sku: SKU,
    quantity: 120,
    refType: "sales_order",
    refId: "550e8400-e29b-41d4-a716-446655440099",
  });
  if (!committed.ok) {
    throw new Error("expected commit");
  }

  const uncoveredReorderPolicy = new InMemoryUncoveredReorderPolicyReadPort();
  uncoveredReorderPolicy.set(
    OrganizationId.DEFAULT,
    LocationId.DEFAULT,
    SKU.value,
    12,
    96,
  );

  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock: new InMemoryClock(new Date("2026-08-28T02:00:00.000Z")),
    staffUsers,
    sessions,
    passwords,
    organizationRepo: organizations,
    productRepo,
    productPackagingRepo: packagingRepo,
    unitOfWork,
    uncoveredReorderPolicyRead: uncoveredReorderPolicy,
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

describe("internal uncovered SKUs HTTP", () => {
  it("requires staff_session and lists uncovered rows with stock context", async () => {
    const app = await startUncoveredApp();
    const missing = await app.inject({ method: "GET", url: "/internal/uncovered-skus" });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toEqual({ error: "unauthorized" });

    const cookie = await staffCookie(app);
    const listed = await app.inject({
      method: "GET",
      url: "/internal/uncovered-skus",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual({
      items: [
        {
          sku: SKU.value,
          uncovered: 120,
          onHand: 0,
          onOrder: 0,
          committed: 120,
          caseQty: 48,
          reorderMin: 12,
          reorderMax: 96,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
    });
  });
});
