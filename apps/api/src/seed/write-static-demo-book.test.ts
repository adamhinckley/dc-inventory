import { InMemoryProductRepository } from "@dc-inventory/catalog";
import {
  InMemoryContactRepository,
  InMemoryCustomerRepository,
  InMemoryExemptionCertificateRepository,
  InMemoryShipToRepository,
} from "@dc-inventory/customers";
import {
  InMemoryClock,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  InMemoryWholesaleUserRepository,
  LoginStaffUseCase,
  LoginWholesaleUseCase,
} from "@dc-inventory/identity";
import {
  PHASE2_DEFAULT_LOCATION_CODE,
  PHASE2_SUPPLIER_NAME,
  PHASE2_SUPPLIER_VENDOR_NUMBER,
} from "@dc-inventory/inventory";
import { InMemorySupplierRepository } from "@dc-inventory/purchasing";
import { SupplierId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { DEFAULT_DEMO_SEED } from "./planner/constants.js";
import { planDemoBook } from "./planner/plan-demo-book.js";
import {
  PHASE1_CUSTOMER_NAME,
  PHASE1_PRODUCT_SKUS,
  PHASE1_PRODUCTS,
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
        const existing = await suppliers.findByVendorNumber(PHASE2_SUPPLIER_VENDOR_NUMBER);
        if (existing) {
          return { id: existing.id, vendorNumber: existing.vendorNumber };
        }
        const id = SupplierId.parse(crypto.randomUUID());
        await suppliers.save({
          id,
          vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER,
          name: PHASE2_SUPPLIER_NAME,
        });
        return { id, vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER };
      },
    },
  };
}

describe("static demo book writer (in-memory)", () => {
  it("writes the full static master book from a deterministic plan", async () => {
    const ports = staticSeedPorts();
    const contacts = new InMemoryContactRepository();
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

    const listedProducts = await ports.products.listMatching({ shopVisibleOnly: true });
    expect(listedProducts).toHaveLength(FULL_DEMO_RECONCILIATION_EXPECTATIONS.productCount);

    const supplierRows = await ports.suppliers.findByVendorNumber(PHASE2_SUPPLIER_VENDOR_NUMBER);
    expect(supplierRows?.name).toBe(PHASE2_SUPPLIER_NAME);

    const listedSuppliers = new Set<string>();
    for (const vendorNumber of plan.master.suppliers.map((row) => row.vendorNumber)) {
      const supplier = await ports.suppliers.findByVendorNumber(vendorNumber);
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
    expect(await contacts.listByCustomer(acme!.id)).toEqual([]);

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
      ports.staffUsers,
      sessions,
      ports.passwords,
      clock,
    ).execute({ email: PHASE1_STAFF_EMAIL, password: "staff-rotated" });
    expect(staffLogin.ok).toBe(true);

    const wholesaleLogin = await new LoginWholesaleUseCase(
      ports.wholesaleUsers,
      sessions,
      ports.passwords,
      clock,
    ).execute({ email: PHASE1_WHOLESALE_EMAIL, password: "wholesale-rotated" });
    expect(wholesaleLogin.ok).toBe(true);
    if (wholesaleLogin.ok) {
      expect(wholesaleLogin.customerId).toBe(acme?.id);
    }
  });
});
