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
  UNCOVERED_NEEDS_MAPPING_FACTORY_ROW_ID,
} from "@dc-inventory/inventory";
import {
  AssignSupplierProductUseCase,
  InMemoryCatalogSkuLookupPort,
  InMemorySupplierProductRepository,
  InMemorySupplierSkuMappingReadPort,
  SupplierProductId,
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
const SKU_AMBIGUOUS = Sku.parse("UNCOVERED-HTTP-AMB");
const SUPPLIER_A = SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const SUPPLIER_B = SupplierId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

const unmappedEnrichment = {
  supplierId: null,
  supplierNumber: null,
  supplierName: null,
  mappingStatus: "unmapped",
  draftPurchaseOrder: null,
};

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

async function startUncoveredApp(options?: {
  withDraftSuppliers?: boolean;
  withAmbiguousSku?: boolean;
  withoutPoPrefix?: boolean;
}) {
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
      poPrefix: options?.withoutPoPrefix ? null : "FA",
    });
    await unitOfWork.suppliers.save({
      id: SUPPLIER_B,
      organizationId: OrganizationId.DEFAULT,
      vendorNumber: "V-B",
      name: "Factory B",
      poPrefix: options?.withoutPoPrefix ? null : "FB",
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

    if (options?.withAmbiguousSku) {
      const createdAmbiguous = await createProduct.execute({
        organizationId: OrganizationId.DEFAULT,
        staffUserId: STAFF_ID,
        sku: SKU_AMBIGUOUS.value,
        name: "Uncovered ambiguous",
        uom: "EA",
        memberPriceCents: 500,
        taxCategoryCode: "P0000000",
      });
      if (!createdAmbiguous.ok) {
        throw new Error("expected ambiguous product");
      }
      await supplierProductRepo.save({
        id: SupplierProductId.parse("77777777-7777-4777-8777-777777777777"),
        supplierId: SUPPLIER_A,
        sku: SKU_AMBIGUOUS,
        supplierSku: "A-AMB",
        minOrderQty: null,
        minOrderAmountCents: null,
        lastPoCostCents: null,
        currency: "USD",
      });
      await supplierProductRepo.save({
        id: SupplierProductId.parse("88888888-8888-4888-8888-888888888888"),
        supplierId: SUPPLIER_B,
        sku: SKU_AMBIGUOUS,
        supplierSku: "B-AMB",
        minOrderQty: null,
        minOrderAmountCents: null,
        lastPoCostCents: null,
        currency: "USD",
      });
      const committedAmbiguous = await unitOfWork.inventory.ledger.recordCommitted({
        organizationId: OrganizationId.DEFAULT,
        idempotencyKey: "uncovered-http-commit-amb",
        sku: SKU_AMBIGUOUS,
        quantity: 18,
        refType: "sales_order",
        refId: "550e8400-e29b-41d4-a716-446655440102",
      });
      if (!committedAmbiguous.ok) {
        throw new Error("expected ambiguous commit");
      }
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
      catalog.set(OrganizationId.DEFAULT, SKU_AMBIGUOUS.value, "Uncovered ambiguous");
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
          ...unmappedEnrichment,
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
        documentNumber: string;
        lines: Array<{ sku: string; qty: number }>;
      }>;
      unmappedSkus: string[];
    };
    expect(body.unmappedSkus).toEqual([SKU_UNMAPPED.value]);
    expect(body.purchaseOrders).toHaveLength(2);
    const bySupplier = new Map(body.purchaseOrders.map((po) => [po.supplierId, po]));
    expect(bySupplier.get(SUPPLIER_A)?.documentNumber).toBe("PO-FA-00001");
    expect(bySupplier.get(SUPPLIER_B)?.documentNumber).toBe("PO-FB-00001");
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

  it("lists factory summary rows with a needs-mapping bucket", async () => {
    const app = await startUncoveredApp({ withDraftSuppliers: true });
    const cookie = await staffCookie(app);
    const listed = await app.inject({
      method: "GET",
      url: "/internal/uncovered-skus/factories",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual({
      items: [
        {
          id: SUPPLIER_A,
          supplierId: SUPPLIER_A,
          supplierNumber: "V-A",
          supplierName: "Factory A",
          poPrefix: "FA",
          productCount: 1,
          totalUncoveredUnits: 120,
          needsMapping: false,
        },
        {
          id: SUPPLIER_B,
          supplierId: SUPPLIER_B,
          supplierNumber: "V-B",
          supplierName: "Factory B",
          poPrefix: "FB",
          productCount: 1,
          totalUncoveredUnits: 40,
          needsMapping: false,
        },
        {
          id: UNCOVERED_NEEDS_MAPPING_FACTORY_ROW_ID,
          supplierId: null,
          supplierNumber: null,
          supplierName: "Needs mapping",
          poPrefix: null,
          productCount: 1,
          totalUncoveredUnits: 25,
          needsMapping: true,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 3,
    });
  });

  it("omits factories with open draft POs when excludeSuppliersWithOpenDraft is true", async () => {
    const app = await startUncoveredApp({ withDraftSuppliers: true });
    const cookie = await staffCookie(app);
    const drafted = await app.inject({
      method: "POST",
      url: "/internal/uncovered-skus/draft-purchase-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { skus: [SKU.value] },
    });
    expect(drafted.statusCode).toBe(201);

    const unfiltered = await app.inject({
      method: "GET",
      url: "/internal/uncovered-skus/factories",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(unfiltered.statusCode).toBe(200);
    expect((unfiltered.json() as { total: number }).total).toBe(3);

    const filtered = await app.inject({
      method: "GET",
      url: "/internal/uncovered-skus/factories?excludeSuppliersWithOpenDraft=true",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(filtered.statusCode).toBe(200);
    expect(filtered.json()).toEqual({
      items: [
        {
          id: SUPPLIER_B,
          supplierId: SUPPLIER_B,
          supplierNumber: "V-B",
          supplierName: "Factory B",
          poPrefix: "FB",
          productCount: 1,
          totalUncoveredUnits: 40,
          needsMapping: false,
        },
        {
          id: UNCOVERED_NEEDS_MAPPING_FACTORY_ROW_ID,
          supplierId: null,
          supplierNumber: null,
          supplierName: "Needs mapping",
          poPrefix: null,
          productCount: 1,
          totalUncoveredUnits: 25,
          needsMapping: true,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 2,
    });
  });

  it("filters enriched SKU rows by supplier and needsMapping and surfaces draft PO refs", async () => {
    const app = await startUncoveredApp({ withDraftSuppliers: true });
    const cookie = await staffCookie(app);
    const drafted = await app.inject({
      method: "POST",
      url: "/internal/uncovered-skus/draft-purchase-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { skus: [SKU.value] },
    });
    expect(drafted.statusCode).toBe(201);
    const draftBody = drafted.json() as {
      purchaseOrders: Array<{ id: string; documentNumber: string }>;
    };
    expect(draftBody.purchaseOrders[0]?.documentNumber).toBe("PO-FA-00001");

    const bySupplier = await app.inject({
      method: "GET",
      url: `/internal/uncovered-skus?supplierId=${SUPPLIER_A}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(bySupplier.statusCode).toBe(200);
    expect(bySupplier.json()).toMatchObject({
      total: 1,
      items: [
        {
          sku: SKU.value,
          supplierId: SUPPLIER_A,
          supplierNumber: "V-A",
          supplierName: "Factory A",
          mappingStatus: "mapped",
          draftPurchaseOrder: {
            id: draftBody.purchaseOrders[0]?.id,
            documentNumber: draftBody.purchaseOrders[0]?.documentNumber,
          },
        },
      ],
    });

    const needsMapping = await app.inject({
      method: "GET",
      url: "/internal/uncovered-skus?needsMapping=true",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(needsMapping.statusCode).toBe(200);
    expect(needsMapping.json()).toMatchObject({
      total: 1,
      items: [
        {
          sku: SKU_UNMAPPED.value,
          mappingStatus: "unmapped",
          draftPurchaseOrder: null,
        },
      ],
    });
  });

  it("surfaces ambiguous mapping when a SKU maps to multiple suppliers", async () => {
    const app = await startUncoveredApp({
      withDraftSuppliers: true,
      withAmbiguousSku: true,
    });
    const cookie = await staffCookie(app);

    const listed = await app.inject({
      method: "GET",
      url: "/internal/uncovered-skus",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(listed.statusCode).toBe(200);
    const ambiguousRow = (listed.json() as { items: Array<{ sku: string }> }).items.find(
      (row) => row.sku === SKU_AMBIGUOUS.value,
    );
    expect(ambiguousRow).toMatchObject({
      sku: SKU_AMBIGUOUS.value,
      supplierId: null,
      supplierNumber: null,
      supplierName: null,
      mappingStatus: "ambiguous",
      draftPurchaseOrder: null,
    });

    const needsMapping = await app.inject({
      method: "GET",
      url: "/internal/uncovered-skus?needsMapping=true",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(needsMapping.statusCode).toBe(200);
    expect((needsMapping.json() as { total: number }).total).toBe(2);
    expect(
      (needsMapping.json() as { items: Array<{ sku: string }> }).items.map((row) => row.sku).sort(),
    ).toEqual([SKU_AMBIGUOUS.value, SKU_UNMAPPED.value].sort());

    const bySupplierA = await app.inject({
      method: "GET",
      url: `/internal/uncovered-skus?supplierId=${SUPPLIER_A}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(bySupplierA.statusCode).toBe(200);
    expect((bySupplierA.json() as { total: number }).total).toBe(1);
    expect((bySupplierA.json() as { items: Array<{ sku: string }> }).items[0]?.sku).toBe(
      SKU.value,
    );
  });

  it("syncs open draft PO lines from current uncovered SKUs", async () => {
    const app = await startUncoveredApp({ withDraftSuppliers: true });
    const cookie = await staffCookie(app);

    const drafted = await app.inject({
      method: "POST",
      url: "/internal/uncovered-skus/draft-purchase-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { skus: [SKU.value, SKU_B.value] },
    });
    expect(drafted.statusCode).toBe(201);
    const draftBody = drafted.json() as {
      purchaseOrders: Array<{ id: string; supplierId: string }>;
    };
    const poA = draftBody.purchaseOrders.find((po) => po.supplierId === SUPPLIER_A);
    expect(poA).toBeDefined();
    if (poA === undefined) {
      return;
    }

    const stale = await app.inject({
      method: "PATCH",
      url: `/internal/purchase-orders/${poA.id}`,
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {
        lines: [{ sku: SKU.value, name: "Uncovered widget", qty: 1 }],
      },
    });
    expect(stale.statusCode).toBe(200);

    const synced = await app.inject({
      method: "POST",
      url: "/internal/purchase-orders/sync-from-uncovered",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: {},
    });
    expect(synced.statusCode).toBe(200);
    const body = synced.json() as {
      purchaseOrders: Array<{
        id: string;
        supplierId: string;
        lines: Array<{ sku: string; qty: number }>;
      }>;
    };
    const syncedA = body.purchaseOrders.find((po) => po.supplierId === SUPPLIER_A);
    expect(syncedA?.id).toBe(poA.id);
    expect(
      syncedA?.lines.map((line) => ({ sku: line.sku, qty: line.qty })),
    ).toEqual([{ sku: SKU.value, qty: suggestedDraftPoQty(120, 48) }]);
    const syncedB = body.purchaseOrders.find((po) => po.supplierId === SUPPLIER_B);
    expect(
      syncedB?.lines.map((line) => ({ sku: line.sku, qty: line.qty })),
    ).toEqual([{ sku: SKU_B.value, qty: suggestedDraftPoQty(40, null) }]);
  });

  it("drafts POs for suppliers without poPrefix using a fallback document number", async () => {
    const app = await startUncoveredApp({ withDraftSuppliers: true, withoutPoPrefix: true });
    const cookie = await staffCookie(app);
    const factories = await app.inject({
      method: "GET",
      url: "/internal/uncovered-skus/factories",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
    });
    expect(factories.statusCode).toBe(200);
    expect(
      (factories.json() as { items: Array<{ id: string; poPrefix: string | null }> }).items.map(
        (row) => ({ id: row.id, poPrefix: row.poPrefix }),
      ),
    ).toEqual([
      { id: SUPPLIER_A, poPrefix: null },
      { id: SUPPLIER_B, poPrefix: null },
      { id: UNCOVERED_NEEDS_MAPPING_FACTORY_ROW_ID, poPrefix: null },
    ]);
    const drafted = await app.inject({
      method: "POST",
      url: "/internal/uncovered-skus/draft-purchase-orders",
      cookies: { [STAFF_SESSION_COOKIE]: cookie },
      payload: { skus: [SKU.value] },
    });
    expect(drafted.statusCode).toBe(201);
    expect(drafted.json()).toMatchObject({
      purchaseOrders: [
        expect.objectContaining({
          supplierId: SUPPLIER_A,
          documentNumber: "PO-OP06-00001",
          status: "draft",
        }),
      ],
    });
  });

  it("requires staff_session to sync draft purchase orders from uncovered", async () => {
    const app = await startUncoveredApp({ withDraftSuppliers: true });
    const missing = await app.inject({
      method: "POST",
      url: "/internal/purchase-orders/sync-from-uncovered",
      payload: {},
    });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toEqual({ error: "unauthorized" });
  });
});
