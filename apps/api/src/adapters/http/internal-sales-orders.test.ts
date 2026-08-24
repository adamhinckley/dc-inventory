import {
  InMemoryClock,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
} from "@dc-inventory/identity";
import {
  RecordAdjustmentIncreaseUseCase,
} from "@dc-inventory/inventory";
import { CustomerId, LocationId, Sku, StaffUserId } from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryUnitOfWork } from "../../adapters/in-memory-unit-of-work.js";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { STAFF_SESSION_COOKIE } from "./auth-cookies.js";
import { InMemoryCustomerRepository } from "@dc-inventory/customers";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const SKU = Sku.parse("HEX-BOLT-GALV");

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startSalesApp() {
  const passwords = new InMemoryPasswordHasher();
  const staffUsers = new InMemoryStaffUserRepository();
  const sessions = new InMemorySessionStore();
  const customerRepo = new InMemoryCustomerRepository();
  const unitOfWork = new InMemoryUnitOfWork();

  await customerRepo.save({
    id: CUSTOMER_ID,
    name: "Acme Wholesale",
    accountNumber: "ACME-001",
    terms: "NET30",
    creditLimitCents: 1_000_000,
    currency: "USD",
    inactive: false,
  });

  await staffUsers.save({
    id: STAFF_ID,
    email: "staff@local.test",
    passwordHash: await passwords.hash("staff-secret"),
  });

  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    clock: new InMemoryClock(new Date("2026-08-24T03:30:00.000Z")),
    staffUsers,
    sessions,
    passwords,
    unitOfWork,
    customerRepo,
    salesOrderRepo: unitOfWork.salesOrders,
  });
  apps.push(app);
  return { app, unitOfWork };
}

async function staffCookie(app: Awaited<ReturnType<typeof buildApp>>) {
  const login = await app.inject({
    method: "POST",
    url: "/internal/auth/login",
    payload: { email: "staff@local.test", password: "staff-secret" },
  });
  const cookie = login.cookies.find((row) => row.name === STAFF_SESSION_COOKIE);
  return cookie?.value ?? "";
}

describe("internal sales orders HTTP", () => {
  it("requires staff_session", async () => {
    const { app } = await startSalesApp();
    const response = await app.inject({ method: "GET", url: "/internal/sales-orders" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "unauthorized" });
  });

  it("rejects invalid create body with Zod", async () => {
    const { app } = await startSalesApp();
    const cookie = await staffCookie(app);
    const response = await app.inject({
      method: "POST",
      url: "/internal/sales-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { customerId: CUSTOMER_ID, lines: [] },
    });
    expect(response.statusCode).toBe(400);
  });

  it("runs create, confirm, and cancel", async () => {
    const { app, unitOfWork } = await startSalesApp();
    const cookie = await staffCookie(app);

    await unitOfWork.run(async (scope) => {
      const result = await new RecordAdjustmentIncreaseUseCase(scope.inventory.ledger).execute({
        idempotencyKey: "http-seed-stock",
        sku: SKU,
        quantity: 10,
        refType: "adjustment",
        refId: "http-seed",
      });
      expect(result.ok).toBe(true);
    });

    const created = await app.inject({
      method: "POST",
      url: "/internal/sales-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        customerId: CUSTOMER_ID,
        lines: [
          {
            sku: SKU.value,
            name: "Hex bolt",
            qty: 5,
            unitPriceCents: 250,
            currency: "USD",
          },
        ],
      },
    });
    expect(created.statusCode).toBe(201);
    const order = created.json() as { id: string; documentNumber: string };
    expect(order.documentNumber).toBe("SO-00001");

    const confirmed = await app.inject({
      method: "POST",
      url: `/internal/sales-orders/${order.id}/confirm`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { idempotencyKey: "http-confirm" },
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json()).toMatchObject({ status: "confirmed" });

    const cancelled = await app.inject({
      method: "POST",
      url: `/internal/sales-orders/${order.id}/cancel`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { idempotencyKey: "http-cancel" },
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toMatchObject({ status: "cancelled" });
  });
});
