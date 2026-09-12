import { InMemoryProductRepository } from "@dc-inventory/catalog";
import {
  InMemoryCustomerRepository,
  InMemoryExemptionCertificateRepository,
  InMemoryShipToRepository,
} from "@dc-inventory/customers";
import {
  InMemoryClock,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemoryPlatformUserRepository,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  InMemoryWholesaleUserRepository,
  LoginStaffUseCase,
  LoginWholesaleUseCase,
  ACTIVE_WHOLESALE_LOGIN_ACCOUNT_STATUS,
} from "@dc-inventory/identity";
import {
  PHASE2_DEFAULT_LOCATION_CODE,
  PHASE2_SUPPLIER_NAME,
  PHASE2_SUPPLIER_VENDOR_NUMBER,
} from "@dc-inventory/inventory";
import { InMemorySupplierRepository } from "@dc-inventory/purchasing";
import { OrganizationId, SupplierId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { DEFAULT_DEMO_SEED, GENERATED_SKU_COUNT, GENERATED_SKU_FIRST } from "./planner/constants.js";
import { planDemoBook } from "./planner/plan-demo-book.js";
import {
  PHASE1_CUSTOMER_CURRENCY,
  PHASE1_CUSTOMER_NAME,
  PHASE1_CUSTOMER_TERMS,
  PHASE1_ORGANIZATION_SLUG,
  PHASE1_PRODUCT_SKUS,
  PHASE1_PRODUCTS,
  PHASE1_NORTHSTAR_WHOLESALE_EMAIL,
  PHASE1_STAFF_EMAIL,
  PHASE1_WHOLESALE_EMAIL,
} from "./phase1-fixture.js";
import {
  DEMO_NAMED_CUSTOMERS,
  FULL_DEMO_RECONCILIATION_EXPECTATIONS,
} from "./reconciliation/expectations.js";
import { InMemoryProductImageSeedRepository } from "./ports/in-memory-product-image-seed.js";
import { InMemorySupplierProductSeedRepository } from "./ports/in-memory-supplier-product-seed.js";
import type { StaticDemoSeedPorts } from "./ports/static-seed-types.js";
import {
  STATIC_EXEMPTION_EXPIRY_DAYS,
  runWriteStaticDemoBook,
} from "./write-static-demo-book.js";

const SEED_TODAY = new Date("2026-08-24T15:30:00.000Z");

function inMemoryUserCount(repo: InMemoryStaffUserRepository | InMemoryWholesaleUserRepository): number {
  const internal = repo as unknown as { byOrgEmail?: Map<string, unknown>; byEmail?: Map<string, unknown> };
  return (internal.byOrgEmail ?? internal.byEmail)?.size ?? 0;
}

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
          poPrefix: "V01",
        });
        return { id, vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER };
      },
    },
  };
}

describe("static demo book writer (in-memory)", () => {
  it("writes the full static master book from a deterministic plan", async () => {
    const ports = staticSeedPorts();
    const sessions = new InMemorySessionStore();
    const plan = planDemoBook({ seed: DEFAULT_DEMO_SEED, seedToday: SEED_TODAY });

    const first = await runWriteStaticDemoBook(ports, plan, {
      staffPassword: "staff-placeholder",
      wholesalePassword: "wholesale-placeholder",
    });

    expect(first.bootstrap.location.code).toBe(PHASE2_DEFAULT_LOCATION_CODE);
    expect(first.products).toHaveLength(FULL_DEMO_RECONCILIATION_EXPECTATIONS.productCount);
    expect(first.customers).toHaveLength(FULL_DEMO_RECONCILIATION_EXPECTATIONS.customerCount);
    expect(first.shipTos).toHaveLength(FULL_DEMO_RECONCILIATION_EXPECTATIONS.customerCount);
    expect(first.exemptionCertificates).toHaveLength(
      FULL_DEMO_RECONCILIATION_EXPECTATIONS.exemptionCertificateCount,
    );
    expect(await ports.productImages.listAll()).toHaveLength(
      FULL_DEMO_RECONCILIATION_EXPECTATIONS.imageCount,
    );
    expect(await ports.supplierProducts.listAll()).toHaveLength(
      FULL_DEMO_RECONCILIATION_EXPECTATIONS.supplierProductCount,
    );

    const listedProducts = await ports.products.listMatching({
      organizationId: OrganizationId.DEFAULT,
      shopVisibleOnly: true,
    });
    expect(listedProducts).toHaveLength(FULL_DEMO_RECONCILIATION_EXPECTATIONS.productCount);

    const supplierRows = await ports.suppliers.findByVendorNumber(
      OrganizationId.DEFAULT,
      PHASE2_SUPPLIER_VENDOR_NUMBER,
    );
    expect(supplierRows?.name).toBe(PHASE2_SUPPLIER_NAME);

    const listedSuppliers = new Set<string>();
    for (const vendorNumber of plan.master.suppliers.map((row) => row.vendorNumber)) {
      const supplier = await ports.suppliers.findByVendorNumber(OrganizationId.DEFAULT, vendorNumber);
      expect(supplier).not.toBeNull();
      if (supplier) {
        listedSuppliers.add(supplier.vendorNumber);
      }
    }
    expect(listedSuppliers.size).toBe(FULL_DEMO_RECONCILIATION_EXPECTATIONS.supplierCount);

    for (const sku of PHASE1_PRODUCT_SKUS) {
      const fixture = PHASE1_PRODUCTS.find((row) => row.sku === sku);
      const product = first.products.find((row) => row.sku.value === sku);
      expect(fixture).toBeDefined();
      expect(product).toBeDefined();
      if (!fixture || !product) {
        continue;
      }
      expect(product.name).toBe(fixture.name);
      expect(product.uom).toBe(fixture.uom);
      expect(product.memberPrice.amountMinor).toBe(fixture.memberPriceCents);
      expect(product.taxCategoryCode).toBe("TANGIBLE");
    }

    const generatedProducts = first.products.filter((row) => row.sku.value.startsWith("DEM-"));
    expect(generatedProducts).toHaveLength(GENERATED_SKU_COUNT);
    const generatedSkus = generatedProducts.map((row) => row.sku.value).sort();
    expect(generatedSkus[0]).toBe("DEM-00001");
    expect(generatedSkus[GENERATED_SKU_COUNT - 1]).toBe(
      `DEM-${String(GENERATED_SKU_FIRST + GENERATED_SKU_COUNT - 1).padStart(5, "0")}`,
    );
    for (const planned of plan.master.products.filter((row) => !row.isPhase1Fixture)) {
      const product = first.products.find((row) => row.sku.value === planned.sku);
      expect(product?.name).toBe(planned.name);
      expect(product?.uom).toBe(planned.uom);
      expect(product?.description).toBeNull();
      expect(product?.memberPrice.amountMinor).toBe(planned.memberPriceCents);
      expect(product?.memberPrice.currency).toBe(planned.currency);
      expect(product?.webWholesale).toBe(true);
      expect(product?.taxCategoryCode).toBe(planned.taxCategoryCode);
    }

    const shipToByCustomerKey = new Map(
      plan.master.shipTos.map((row) => [row.customerKey, row]),
    );
    for (const customer of first.customers) {
      const plannedCustomer = plan.master.customers.find(
        (row) => row.name === customer.name,
      );
      expect(plannedCustomer).toBeDefined();
      if (!plannedCustomer) {
        continue;
      }
      const plannedShipTo = shipToByCustomerKey.get(plannedCustomer.key);
      expect(plannedShipTo).toBeDefined();
      const shipTo = first.shipTos.find((row) => row.customerId === customer.id);
      expect(shipTo?.line1).toBe(plannedShipTo?.line1);
      expect(shipTo?.city).toBe(plannedShipTo?.city);
      expect(shipTo?.region).toBe(plannedShipTo?.region);
      expect(shipTo?.postal).toBe(plannedShipTo?.postal);
    }

    for (const customer of first.customers) {
      expect(customer.terms).toBe(PHASE1_CUSTOMER_TERMS);
      expect(customer.creditLimit.currency).toBe(PHASE1_CUSTOMER_CURRENCY);
      const isNamed = Object.values(DEMO_NAMED_CUSTOMERS).some((pin) => pin.name === customer.name);
      if (!isNamed) {
        expect(customer.creditLimit.amountMinor).toBe(
          FULL_DEMO_RECONCILIATION_EXPECTATIONS.mixCustomerCreditLimitCents,
        );
      }
      const shipTosForCustomer = first.shipTos.filter((row) => row.customerId === customer.id);
      expect(shipTosForCustomer).toHaveLength(1);
      const shipTo = shipTosForCustomer[0];
      expect(shipTo?.isDefault).toBe(true);
      expect(shipTo?.country).toBe("US");
    }

    const acme = first.customers.find((row) => row.name === PHASE1_CUSTOMER_NAME);
    expect(acme).toBeDefined();
    if (acme) {
      expect(acme.creditLimit.amountMinor).toBe(DEMO_NAMED_CUSTOMERS.acme.creditLimitCents);
      expect(acme.terms).toBe("Net 30");
    }

    for (const [key, pin] of Object.entries(DEMO_NAMED_CUSTOMERS)) {
      const customer = first.customers.find((row) => row.name === pin.name);
      expect(customer, `named customer ${key}`).toBeDefined();
      if (!customer) {
        continue;
      }
      expect(customer.creditLimit.amountMinor).toBe(pin.creditLimitCents);
      const shipTo = first.shipTos.find((row) => row.customerId === customer.id);
      expect(shipTo?.line1).toBe(pin.ship.line1);
      expect(shipTo?.city).toBe(pin.ship.city);
      expect(shipTo?.region).toBe(pin.ship.region);
      expect(shipTo?.postal).toBe(pin.ship.postal);
    }

    for (const image of await ports.productImages.listAll()) {
      const product = first.products.find((row) => row.id === image.productId);
      expect(product).toBeDefined();
      if (!product) {
        continue;
      }
      expect(image.objectKey).toBe(`demo/catalog/${product.sku.value}.jpg`);
      expect(image.contentType).toBe("image/jpeg");
    }

    const exemptionExpiry = new Date(
      SEED_TODAY.getTime() + STATIC_EXEMPTION_EXPIRY_DAYS * 86_400_000,
    );
    for (const cert of first.exemptionCertificates) {
      const shipTo = first.shipTos.find((row) => row.customerId === cert.customerId);
      expect(cert.objectKey).toBeNull();
      expect(cert.entityUseCode).toBe("RESALE");
      expect(cert.status).toBe("active");
      expect(cert.expiresAt?.getTime()).toBe(exemptionExpiry.getTime());
      expect(cert.jurisdiction).toBe(shipTo?.region);
    }

    expect(first.staff.email).toBe(PHASE1_STAFF_EMAIL);
    expect(first.wholesale.email).toBe(PHASE1_WHOLESALE_EMAIL);
    expect(first.wholesale.customerId).toBe(acme?.id);
    const northstar = first.customers.find((row) => row.name === DEMO_NAMED_CUSTOMERS.northstar.name);
    const northstarWholesale = await ports.wholesaleUsers.findByEmail(
      OrganizationId.DEFAULT,
      PHASE1_NORTHSTAR_WHOLESALE_EMAIL,
    );
    expect(northstarWholesale?.customerId).toBe(northstar?.id);
    expect(inMemoryUserCount(ports.staffUsers)).toBe(1);
    expect(inMemoryUserCount(ports.wholesaleUsers)).toBe(2);
    expect(await ports.staffUsers.findByEmail(OrganizationId.DEFAULT, "other@local.test")).toBeNull();
    expect(await ports.wholesaleUsers.findByEmail(OrganizationId.DEFAULT, "other@local.test")).toBeNull();

    const vend001 = await ports.suppliers.findByVendorNumber(
      OrganizationId.DEFAULT,
      PHASE2_SUPPLIER_VENDOR_NUMBER,
    );
    expect(vend001?.name).toBe(PHASE2_SUPPLIER_NAME);
    const supplierProducts = await ports.supplierProducts.listAll();
    const skuToSupplier = new Map(supplierProducts.map((row) => [row.sku, row.supplierId]));
    for (const sku of PHASE1_PRODUCT_SKUS) {
      expect(skuToSupplier.get(sku)).toBe(vend001?.id);
    }
    const perSupplier = new Map<string, number>();
    for (const row of supplierProducts) {
      perSupplier.set(row.supplierId, (perSupplier.get(row.supplierId) ?? 0) + 1);
      expect(row.minOrderQty).toBeNull();
    }
    for (const supplier of plan.master.suppliers) {
      const persisted = await ports.suppliers.findByVendorNumber(
        OrganizationId.DEFAULT,
        supplier.vendorNumber,
      );
      const count = perSupplier.get(persisted?.id ?? "") ?? 0;
      expect(count).toBeGreaterThanOrEqual(FULL_DEMO_RECONCILIATION_EXPECTATIONS.supplierSkuMin);
      expect(count).toBeLessThanOrEqual(FULL_DEMO_RECONCILIATION_EXPECTATIONS.supplierSkuMax);
    }

    const vendorPartition = new Map<string, string>();
    for (const row of await ports.supplierProducts.listAll()) {
      expect(vendorPartition.has(row.sku)).toBe(false);
      vendorPartition.set(row.sku, row.supplierId);
    }
    expect(vendorPartition.size).toBe(FULL_DEMO_RECONCILIATION_EXPECTATIONS.productCount);

    const second = await runWriteStaticDemoBook(ports, plan, {
      staffPassword: "staff-rotated",
      wholesalePassword: "wholesale-rotated",
    });
    expect(second.products.map((row) => row.id)).toEqual(first.products.map((row) => row.id));
    expect(second.customers.map((row) => row.id)).toEqual(first.customers.map((row) => row.id));

    const clock = new InMemoryClock(new Date("2026-08-24T16:00:00.000Z"));
    const staffLogin = await new LoginStaffUseCase(
      ports.organizations,
      ports.staffUsers,
      new InMemoryPlatformUserRepository(),
      sessions,
      ports.passwords,
      clock,
    ).execute({
      organizationSlug: PHASE1_ORGANIZATION_SLUG,
      email: PHASE1_STAFF_EMAIL,
      password: "staff-rotated",
    });
    expect(staffLogin.ok).toBe(true);

    const wholesaleLogin = await new LoginWholesaleUseCase(
      ports.organizations,
      ports.wholesaleUsers,
      ports.staffUsers,
      sessions,
      ports.passwords,
      clock,
      ACTIVE_WHOLESALE_LOGIN_ACCOUNT_STATUS,
    ).execute({
      organizationSlug: PHASE1_ORGANIZATION_SLUG,
      email: PHASE1_WHOLESALE_EMAIL,
      password: "wholesale-rotated",
    });
    expect(wholesaleLogin.ok).toBe(true);
    if (wholesaleLogin.ok) {
      expect(wholesaleLogin.customerId).toBe(acme?.id);
    }

    const staffActingLogin = await new LoginWholesaleUseCase(
      ports.organizations,
      ports.wholesaleUsers,
      ports.staffUsers,
      sessions,
      ports.passwords,
      clock,
      ACTIVE_WHOLESALE_LOGIN_ACCOUNT_STATUS,
    ).execute({
      organizationSlug: PHASE1_ORGANIZATION_SLUG,
      email: PHASE1_STAFF_EMAIL,
      password: "staff-rotated",
    });
    expect(staffActingLogin.ok).toBe(true);
    if (staffActingLogin.ok) {
      expect(staffActingLogin.mode).toBe("staff_acting");
      expect(staffActingLogin.customerId).toBeNull();
    }
  });

  it("skips products and vendors when persistCatalog is false", async () => {
    const ports = staticSeedPorts();
    const plan = planDemoBook({ seed: DEFAULT_DEMO_SEED, seedToday: SEED_TODAY });

    const result = await runWriteStaticDemoBook(
      ports,
      plan,
      {
        staffPassword: "staff-placeholder",
        wholesalePassword: "wholesale-placeholder",
      },
      { persistCatalog: false },
    );

    expect(result.products).toEqual([]);
    expect(await ports.products.listMatching({ organizationId: OrganizationId.DEFAULT })).toEqual(
      [],
    );
    expect(await ports.productImages.listAll()).toEqual([]);
    expect(await ports.supplierProducts.listAll()).toEqual([]);
    expect(
      await ports.suppliers.findByVendorNumber(
        OrganizationId.DEFAULT,
        PHASE2_SUPPLIER_VENDOR_NUMBER,
      ),
    ).toBeNull();
    expect(
      await ports.suppliers.list({
        organizationId: OrganizationId.DEFAULT,
        page: 1,
        pageSize: 100,
      }),
    ).toMatchObject({ total: 0, items: [] });
    expect(result.staff.email).toBe(PHASE1_STAFF_EMAIL);
    expect(result.customers.length).toBeGreaterThan(0);
    expect(result.bootstrap.location.code).toBe(PHASE2_DEFAULT_LOCATION_CODE);
  });
});
