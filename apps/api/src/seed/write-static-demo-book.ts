import type { Product } from "@dc-inventory/catalog";
import { emptyProductCatalogAttributes } from "@dc-inventory/catalog";
import type { Customer, ExemptionCertificate, ShipTo } from "@dc-inventory/customers";
import { ExemptionCertificateId, ShipToId } from "@dc-inventory/customers";
import type { StaffUser, WholesaleUser } from "@dc-inventory/identity";
import { type Phase2BootstrapResult } from "@dc-inventory/inventory";
import type { Supplier } from "@dc-inventory/purchasing";
import {
  CustomerId,
  Money,
  ProductId,
  Sku,
  OrganizationId,
  StaffUserId,
  SupplierId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import type { DemoBookPlan } from "./planner/types.js";
import { DEMO_NAMED_CUSTOMERS } from "./reconciliation/expectations.js";
import { Phase1SeedError, type Phase1SeedSecrets } from "./run-phase1-seed.js";
import type { StaticDemoSeedPorts } from "./ports/static-seed-types.js";
import { upsertDefaultOrganization } from "./upsert-default-organization.js";

export const STATIC_EXEMPTION_EXPIRY_DAYS = 365;

export type WriteStaticDemoBookOptions = {
  /**
   * When false, skip products, product images, planned suppliers, supplier
   * products, and the Demo Supplier bootstrap row. Location, customers, and
   * users still write. Defaults to true so in-memory planner tests keep a
   * synthetic catalog.
   */
  persistCatalog?: boolean;
};

export type StaticDemoSeedResult = {
  bootstrap: Phase2BootstrapResult;
  products: Product[];
  customers: Customer[];
  shipTos: ShipTo[];
  exemptionCertificates: ExemptionCertificate[];
  staff: StaffUser;
  wholesale: WholesaleUser;
};

function requirePassword(label: string, value: string): string {
  const password = value.trim();
  if (password.length === 0) {
    throw new Phase1SeedError(`${label} must be a non-empty placeholder`);
  }
  return password;
}

function newId(): string {
  return crypto.randomUUID();
}

function exemptionExpiresAt(seedToday: Date): Date {
  return new Date(seedToday.getTime() + STATIC_EXEMPTION_EXPIRY_DAYS * 86_400_000);
}

async function upsertProduct(
  ports: StaticDemoSeedPorts,
  planned: DemoBookPlan["master"]["products"][number],
): Promise<Product> {
  const sku = Sku.parse(planned.sku);
  const existing = await ports.products.findBySku(OrganizationId.DEFAULT, sku);
  const product: Product = {
    id: existing?.id ?? ProductId.parse(newId()),
    organizationId: OrganizationId.DEFAULT,
    sku,
    name: planned.name,
    description: planned.description,
    uom: planned.uom,
    memberPrice: Money.fromMinorUnits(planned.memberPriceCents, planned.currency),
    listPrice:
      planned.listPriceCents === null
        ? null
        : Money.fromMinorUnits(planned.listPriceCents, planned.currency),
    inactive: false,
    discontinued: false,
    webWholesale: planned.webWholesale,
    taxCategoryCode: planned.taxCategoryCode,
    ...emptyProductCatalogAttributes(),
  };
  await ports.products.save(product);
  return product;
}

async function upsertSupplier(
  ports: StaticDemoSeedPorts,
  planned: DemoBookPlan["master"]["suppliers"][number],
): Promise<Supplier> {
  const existing = await ports.suppliers.findByVendorNumber(OrganizationId.DEFAULT, planned.vendorNumber);
  const supplier: Supplier = {
    id: existing?.id ?? SupplierId.parse(newId()),
    organizationId: OrganizationId.DEFAULT,
    vendorNumber: planned.vendorNumber,
    name: planned.name,
    poPrefix: existing?.poPrefix ?? null,
  };
  await ports.suppliers.save(supplier);
  return supplier;
}

async function upsertCustomer(
  ports: StaticDemoSeedPorts,
  planned: DemoBookPlan["master"]["customers"][number],
): Promise<Customer> {
  const existing = await ports.customers.findByName(OrganizationId.DEFAULT, planned.name);
  const namedPin = Object.values(DEMO_NAMED_CUSTOMERS).find((pin) => pin.name === planned.name);
  const customerNumber =
    existing?.customerNumber ??
    namedPin?.customerNumber ??
    (await ports.customers.allocateNextCustomerNumber(OrganizationId.DEFAULT));
  const customer: Customer = {
    id: existing?.id ?? CustomerId.parse(newId()),
    organizationId: OrganizationId.DEFAULT,
    name: planned.name,
    customerNumber,
    creditLimit: Money.fromMinorUnits(planned.creditLimitCents, planned.currency),
    terms: planned.terms,
    taxId: existing?.taxId ?? null,
    accountStatus: existing?.accountStatus ?? "active",
    customerNote: existing?.customerNote ?? null,
    staffNote: existing?.staffNote ?? null,
    createdAt: existing?.createdAt ?? new Date(),
  };
  await ports.customers.save(customer);
  return customer;
}

async function upsertShipTo(
  ports: StaticDemoSeedPorts,
  planned: DemoBookPlan["master"]["shipTos"][number],
  customerId: CustomerId,
): Promise<ShipTo> {
  const existing = (await ports.shipTos.listByCustomer(customerId)).find(
    (row) => row.isDefault,
  );
  const shipTo: ShipTo = {
    id: existing?.id ?? ShipToId.parse(newId()),
    customerId,
    line1: planned.line1,
    line2: planned.line2,
    city: planned.city,
    region: planned.region,
    postal: planned.postal,
    country: planned.country,
    isDefault: planned.isDefault,
  };
  await ports.shipTos.save(shipTo);
  return shipTo;
}

async function upsertExemption(
  ports: StaticDemoSeedPorts,
  customerId: CustomerId,
  jurisdiction: string,
  expiresAt: Date,
): Promise<ExemptionCertificate> {
  const existing = (await ports.exemptionCertificates.listByCustomer(customerId))[0];
  const certificate: ExemptionCertificate = {
    id: existing?.id ?? ExemptionCertificateId.parse(newId()),
    customerId,
    objectKey: null,
    jurisdiction,
    entityUseCode: "RESALE",
    expiresAt,
    status: "active",
  };
  await ports.exemptionCertificates.save(certificate);
  return certificate;
}

/**
 * Write static Demo master data from a planner output. Does not invoke the Phase 1
 * seed command or create documents, movements, snapshots, invoices, payments, or
 * document numbers.
 */
export async function runWriteStaticDemoBook(
  ports: StaticDemoSeedPorts,
  plan: DemoBookPlan,
  secrets: Phase1SeedSecrets,
  options: WriteStaticDemoBookOptions = {},
): Promise<StaticDemoSeedResult> {
  const persistCatalog = options.persistCatalog !== false;
  const staffPassword = requirePassword("PHASE1_STAFF_PASSWORD", secrets.staffPassword);
  const wholesalePassword = requirePassword(
    "PHASE1_WHOLESALE_PASSWORD",
    secrets.wholesalePassword,
  );

  await upsertDefaultOrganization(ports.organizations);

  const location = await ports.phase2Bootstrap.upsertDefaultLocation();
  const bootstrap: Phase2BootstrapResult = persistCatalog
    ? { location, supplier: await ports.phase2Bootstrap.upsertPrerequisiteSupplier() }
    : {
        location,
        supplier: {
          id: SupplierId.parse("00000000-0000-4000-8000-000000000001"),
          vendorNumber: "UNSEEDED",
        },
      };
  const supplierByKey = new Map<string, Supplier>();

  if (persistCatalog) {
    for (const planned of plan.master.suppliers) {
      const supplier = await upsertSupplier(ports, planned);
      supplierByKey.set(planned.key, supplier);
    }
  }

  const products: Product[] = [];
  if (persistCatalog) {
    for (const planned of plan.master.products) {
      const product = await upsertProduct(ports, planned);
      products.push(product);
      await ports.productImages.save({
        productId: product.id,
        objectKey: planned.imageObjectKey,
        contentType: planned.imageContentType,
      });
    }

    for (const planned of plan.master.supplierProducts) {
      const supplier = supplierByKey.get(planned.supplierKey);
      if (supplier === undefined) {
        throw new Phase1SeedError(`missing supplier key ${planned.supplierKey}`);
      }
      await ports.supplierProducts.save({
        supplierId: supplier.id,
        sku: planned.sku,
        minOrderQty: planned.minOrderQty,
      });
    }
  }

  const customerByKey = new Map<string, Customer>();
  const customers: Customer[] = [];
  for (const planned of plan.master.customers) {
    const customer = await upsertCustomer(ports, planned);
    customerByKey.set(planned.key, customer);
    customers.push(customer);
  }

  const shipTos: ShipTo[] = [];
  const shipToByCustomerKey = new Map<string, ShipTo>();
  for (const planned of plan.master.shipTos) {
    const customer = customerByKey.get(planned.customerKey);
    if (customer === undefined) {
      throw new Phase1SeedError(`missing customer key ${planned.customerKey}`);
    }
    const shipTo = await upsertShipTo(ports, planned, customer.id);
    shipTos.push(shipTo);
    shipToByCustomerKey.set(planned.customerKey, shipTo);
  }

  const exemptionExpiresAtValue = exemptionExpiresAt(plan.seedToday);
  const exemptionCertificates: ExemptionCertificate[] = [];
  for (const planned of plan.master.customers) {
    if (!planned.hasExemptionCertificate) {
      continue;
    }
    const customer = customerByKey.get(planned.key);
    const shipTo = shipToByCustomerKey.get(planned.key);
    if (customer === undefined || shipTo === undefined) {
      throw new Phase1SeedError(`missing customer or ship-to for ${planned.key}`);
    }
    exemptionCertificates.push(
      await upsertExemption(ports, customer.id, shipTo.region, exemptionExpiresAtValue),
    );
  }

  const acme = customerByKey.get(plan.master.wholesaleCustomerKey);
  if (acme === undefined) {
    throw new Phase1SeedError(`missing wholesale customer key ${plan.master.wholesaleCustomerKey}`);
  }

  const existingStaff = await ports.staffUsers.findByEmail(OrganizationId.DEFAULT, plan.master.staffEmail);
  const staff: StaffUser = {
    id: existingStaff?.id ?? StaffUserId.parse(newId()),
    organizationId: OrganizationId.DEFAULT,
    email: plan.master.staffEmail,
    passwordHash: await ports.passwords.hash(staffPassword),
    roles: existingStaff?.roles ?? ["admin"],
  };
  await ports.staffUsers.save(staff);

  const existingWholesale = await ports.wholesaleUsers.findByEmail(
    OrganizationId.DEFAULT,
    plan.master.wholesaleEmail,
  );
  const wholesale: WholesaleUser = {
    id: existingWholesale?.id ?? WholesaleUserId.parse(newId()),
    organizationId: OrganizationId.DEFAULT,
    email: plan.master.wholesaleEmail,
    passwordHash: await ports.passwords.hash(wholesalePassword),
    customerId: acme.id,
  };
  await ports.wholesaleUsers.save(wholesale);

  const northstar = customerByKey.get(plan.master.secondaryWholesaleCustomerKey);
  if (northstar === undefined) {
    throw new Phase1SeedError(
      `missing secondary wholesale customer key ${plan.master.secondaryWholesaleCustomerKey}`,
    );
  }
  const existingSecondaryWholesale = await ports.wholesaleUsers.findByEmail(
    OrganizationId.DEFAULT,
    plan.master.secondaryWholesaleEmail,
  );
  const secondaryWholesale: WholesaleUser = {
    id: existingSecondaryWholesale?.id ?? WholesaleUserId.parse(newId()),
    organizationId: OrganizationId.DEFAULT,
    email: plan.master.secondaryWholesaleEmail,
    passwordHash: await ports.passwords.hash(wholesalePassword),
    customerId: northstar.id,
  };
  await ports.wholesaleUsers.save(secondaryWholesale);

  return {
    bootstrap,
    products,
    customers,
    shipTos,
    exemptionCertificates,
    staff,
    wholesale,
  };
}
