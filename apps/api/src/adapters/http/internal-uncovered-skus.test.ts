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
import {
  AssignSupplierProductUseCase,
  InMemoryCatalogSkuLookupPort,
  InMemorySupplierProductRepository,
  InMemorySupplierSkuMappingReadPort,
} from "@dc-inventory/purchasing";
import {
  LocationId,
  OrganizationId,
  Sku,
  StaffUserId,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import { InMemoryUnitOfWork } from "../in-memory-unit-of-work.js";
import { STAFF_SESSION_COOKIE } from "./auth-cookies.js";
import { loginBody } from "./test-login.js";

const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const SKU = Sku.parse("UNCOVERED-HTTP-1");
const SKU_B = Sku.parse("UNCOVERED-HTTP-2");
const SKU_UNMAPPED = Sku.parse("UNCOVERED-HTTP-X");
const SUPPLIER_A = SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const SUPPLIER_B = SupplierId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

/** Mirrors apps/internal/src/lib/purchase-order-line-math.ts suggestedDraftPoQty. */
function suggestedDraftPoQty(need: number, caseQty: number | null): number {
  if (need <= 0) {
    return 1;
  }
  if (caseQty === null || caseQty <= 0) {
    return need;
  }
  return Math.ceil(need / caseQty) * caseQty;
}

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startUncoveredApp(options?: { withDraftSuppliers?: boolean }) {
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

  if (options?.withDraftSuppliers) {
    const createdB = await createProduct.execute({
      organizationId: OrganizationId.DEFAULT,
      staffUserId: STAFF_ID,
      sku: SKU_B.value,
      name: "Uncovered bolt",
      uom: "EA",
      memberPriceCents: 500,
      taxCategoryCode: "P0000000",
    });
    if (!createdB.ok) {
      throw new Error("expected product B");
    }
    await createProduct.execute({
      organizationId: OrganizationId.DEFAULT,
      staffUserId: STAFF_ID,
      sku: SKU_UNMAPPED.value,
      name: "Uncovered orphan",
      uom: "EA",
      memberPriceCents: 500,
      taxCategoryCode: "P0000000",
    });
  }

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

  const supplierProductRepo = new InMemorySupplierProductRepository();
  if (options?.withDraftSuppliers) {
    await unitOfWork.suppliers.save({
      id: SUPPLIER_A,
      organizationId: OrganizationId.DEFAULT,
      vendorNumber: "V-A",
      name: "Factory A",
    });
    await unitOfWork.suppliers.save({
      id: SUPPLIER_B,
      organizationId: OrganizationId.DEFAULT,
      vendorNumber: "V-B",
      name: "Factory B",
    });
    const catalog = new InMemoryCatalogSkuLookupPort();
    catalog.set(OrganizationId.DEFAULT, SKU.value, "Uncovered widget");
    catalog.set(OrganizationId.DEFAULT, SKU_B.value, "Uncovered bolt");
    const assign = new AssignSupplierProductUseCase(
      unitOfWork.suppliers,
      supplierProductRepo,
      catalog,
    );
    const assignedA = await assign.execute({
      organizationId: OrganizationId.DEFAULT,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_A,
      sku: SKU.value,
    });
    const assignedB = await assign.execute({
      organizationId: OrganizationId.DEFAULT,
      staffUserId: STAFF_ID,
      supplierId: SUPPLIER_B,
      sku: SKU_B.value,
    });
    if (!assignedA.ok || !assignedB.ok) {
      throw new Error("expected supplier product assignments");
    }

    const committedB = await unitOfWork.inventory.ledger.recordCommitted({
      organizationId: OrganizationId.DEFAULT,
      idempotencyKey: "uncovered-http-commit-b",
      sku: SKU_B,
      quantity: 40,
      refType: "sales_order",
      refId: "550e8400-e29b-41d4-a716-446655440100",
    });
    if (!committedB.ok) {
      throw new Error("expected commit B");
    }
    const committedUnmapped = await unitOfWork.inventory.ledger.recordCommitted({
      organizationId: OrganizationId.DEFAULT,
      idempotencyKey: "uncovered-http-commit-x",
      sku: SKU_UNMAPPED,
      quantity: 25,
      refType: "sales_order",
      refId: "550e8400-e29b-41d4-a716-446655440101",
    });
    if (!committedUnmapped.ok) {
      throw new Error("expected commit unmapped");
    }
  }

  const supplierSkuMapping = new InMemorySupplierSkuMappingReadPort(
    unitOfWork.suppliers,
    supplierProductRepo,
  );

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
    supplierProductRepo,
    supplierSkuMapping,
    purchaseOrderRepo: unitOfWork.purchaseOrders,
    supplierRepo: unitOfWork.suppliers,
    catalogSkuLookup: (() => {
      const catalog = new InMemoryCatalogSkuLookupPort();
      catalog.set(OrganizationId.DEFAULT, SKU.value, "Uncovered widget");
      catalog.set(OrganizationId.DEFAULT, SKU_B.value, "Uncovered bolt");
      catalog.set(OrganizationId.DEFAULT, SKU_UNMAPPED.value, "Uncovered orphan");
      return catalog;
    })(),
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

  it("creates one draft PO per supplier, omits unmapped SKUs, and uses suggested qty", async () => {
    const app = await startUncoveredApp({ withDraftSuppliers: true });
    const cookie = await staffCookie(app);
    const drafted = await app.inject({
      method: "POST",
      url: "/internal/uncovered-skus/draft-purchase-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        skus: [SKU.value, SKU_B.value, SKU_UNMAPPED.value],
      },
    });
    expect(drafted.statusCode).toBe(201);
    const body = drafted.json() as {
      purchaseOrders: Array<{
        supplierId: string;
        status: string;
        lines: Array<{ sku: string; qty: number }>;
      }>;
      unmappedSkus: string[];
    };
    expect(body.unmappedSkus).toEqual([SKU_UNMAPPED.value]);
    expect(body.purchaseOrders).toHaveLength(2);
    const bySupplier = new Map(body.purchaseOrders.map((po) => [po.supplierId, po]));
    expect(bySupplier.get(SUPPLIER_A)?.status).toBe("draft");
    expect(bySupplier.get(SUPPLIER_B)?.status).toBe("draft");
    expect(
      bySupplier.get(SUPPLIER_A)?.lines.map((line) => ({
        sku: line.sku,
        qty: line.qty,
      })),
    ).toEqual([{ sku: SKU.value, qty: suggestedDraftPoQty(120, 48) }]);
    expect(
      bySupplier.get(SUPPLIER_B)?.lines.map((line) => ({
        sku: line.sku,
        qty: line.qty,
      })),
    ).toEqual([{ sku: SKU_B.value, qty: suggestedDraftPoQty(40, null) }]);
    expect(bySupplier.get(SUPPLIER_A)?.lines[0]?.qty).toBe(144);
    expect(bySupplier.get(SUPPLIER_B)?.lines[0]?.qty).toBe(40);
  });

  it("requires staff_session to draft purchase orders from uncovered SKUs", async () => {
    const app = await startUncoveredApp({ withDraftSuppliers: true });
    const missing = await app.inject({
      method: "POST",
      url: "/internal/uncovered-skus/draft-purchase-orders",
      payload: { skus: [SKU.value] },
    });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toEqual({ error: "unauthorized" });
  });
});
