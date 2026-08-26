import type { IProductRepository, Product } from "@dc-inventory/catalog";
import type { Customer, ICustomerRepository } from "@dc-inventory/customers";
import type {
  IPasswordHasher,
  IStaffUserRepository,
  IWholesaleUserRepository,
  StaffUser,
  WholesaleUser,
} from "@dc-inventory/identity";
import {
  CustomerId,
  Money,
  ProductId,
  Sku,
  OrganizationId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import {
  PHASE1_CUSTOMER_CREDIT_LIMIT_CENTS,
  PHASE1_CUSTOMER_CURRENCY,
  PHASE1_CUSTOMER_NAME,
  PHASE1_CUSTOMER_TERMS,
  PHASE1_PRODUCTS,
  PHASE1_STAFF_EMAIL,
  PHASE1_WHOLESALE_EMAIL,
  type Phase1ProductFixture,
} from "./phase1-fixture.js";

export type Phase1SeedPorts = {
  products: IProductRepository;
  customers: ICustomerRepository;
  staffUsers: IStaffUserRepository;
  wholesaleUsers: IWholesaleUserRepository;
  passwords: IPasswordHasher;
};

export type Phase1SeedSecrets = {
  staffPassword: string;
  wholesalePassword: string;
};

export type Phase1SeedResult = {
  customer: Customer;
  staff: StaffUser;
  wholesale: WholesaleUser;
  products: Product[];
};

export class Phase1SeedError extends Error {
  override readonly name = "Phase1SeedError";
}

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

async function upsertCustomer(ports: Phase1SeedPorts): Promise<Customer> {
  const existing = await ports.customers.findByName(PHASE1_CUSTOMER_NAME);
  const customer: Customer = {
    id: existing?.id ?? CustomerId.parse(newId()),
    name: PHASE1_CUSTOMER_NAME,
    creditLimit: Money.fromMinorUnits(
      PHASE1_CUSTOMER_CREDIT_LIMIT_CENTS,
      PHASE1_CUSTOMER_CURRENCY,
    ),
    terms: PHASE1_CUSTOMER_TERMS,
  };
  await ports.customers.save(customer);
  return customer;
}

async function upsertStaff(
  ports: Phase1SeedPorts,
  password: string,
): Promise<StaffUser> {
  const existing = await ports.staffUsers.findByEmail(OrganizationId.DEFAULT, PHASE1_STAFF_EMAIL);
  const staff: StaffUser = {
    id: existing?.id ?? StaffUserId.parse(newId()),
    organizationId: OrganizationId.DEFAULT,
    email: PHASE1_STAFF_EMAIL,
    passwordHash: await ports.passwords.hash(password),
  };
  await ports.staffUsers.save(staff);
  return staff;
}

async function upsertWholesale(
  ports: Phase1SeedPorts,
  customerId: Customer["id"],
  password: string,
): Promise<WholesaleUser> {
  const existing = await ports.wholesaleUsers.findByEmail(PHASE1_WHOLESALE_EMAIL);
  const wholesale: WholesaleUser = {
    id: existing?.id ?? WholesaleUserId.parse(newId()),
    email: PHASE1_WHOLESALE_EMAIL,
    passwordHash: await ports.passwords.hash(password),
    customerId,
  };
  await ports.wholesaleUsers.save(wholesale);
  return wholesale;
}

async function upsertProduct(
  ports: Phase1SeedPorts,
  fixture: Phase1ProductFixture,
): Promise<Product> {
  const sku = Sku.parse(fixture.sku);
  const existing = await ports.products.findBySku(sku);
  const product: Product = {
    id: existing?.id ?? ProductId.parse(newId()),
    sku,
    name: fixture.name,
    description: null,
    uom: fixture.uom,
    memberPrice: Money.fromMinorUnits(fixture.memberPriceCents, fixture.currency),
    inactive: false,
    discontinued: false,
    webWholesale: true,
    taxCategoryCode: null,
  };
  await ports.products.save(product);
  return product;
}

/**
 * Upsert Phase 1 local/demo rows. Does not write contacts, ship-tos,
 * exemptions, ops users, sessions, or stock snapshots.
 */
export async function runPhase1Seed(
  ports: Phase1SeedPorts,
  secrets: Phase1SeedSecrets,
): Promise<Phase1SeedResult> {
  const staffPassword = requirePassword("PHASE1_STAFF_PASSWORD", secrets.staffPassword);
  const wholesalePassword = requirePassword(
    "PHASE1_WHOLESALE_PASSWORD",
    secrets.wholesalePassword,
  );

  const customer = await upsertCustomer(ports);
  const staff = await upsertStaff(ports, staffPassword);
  const wholesale = await upsertWholesale(ports, customer.id, wholesalePassword);
  const products: Product[] = [];
  for (const fixture of PHASE1_PRODUCTS) {
    products.push(await upsertProduct(ports, fixture));
  }

  return { customer, staff, wholesale, products };
}
