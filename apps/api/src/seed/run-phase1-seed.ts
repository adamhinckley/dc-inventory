import type { Customer, ICustomerRepository } from "@dc-inventory/customers";
import type {
  IPasswordHasher,
  IOrganizationRepository,
  IStaffUserRepository,
  IWholesaleUserRepository,
  StaffUser,
  WholesaleUser,
} from "@dc-inventory/identity";
import {
  CustomerId,
  Money,
  OrganizationId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { withDemoStaffRoles } from "./demo-staff-roles.js";
import {
  PHASE1_CUSTOMER_CREDIT_LIMIT_CENTS,
  PHASE1_CUSTOMER_CURRENCY,
  PHASE1_CUSTOMER_NAME,
  PHASE1_CUSTOMER_TERMS,
  PHASE1_STAFF_EMAIL,
  PHASE1_WHOLESALE_EMAIL,
} from "./phase1-fixture.js";
import { DEMO_NAMED_CUSTOMERS } from "./reconciliation/expectations.js";
import { upsertDefaultOrganization } from "./upsert-default-organization.js";

export type Phase1SeedPorts = {
  customers: ICustomerRepository;
  organizations: IOrganizationRepository;
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
  const existing = await ports.customers.findByName(OrganizationId.DEFAULT, PHASE1_CUSTOMER_NAME);
  const customerNumber =
    existing?.customerNumber ??
    DEMO_NAMED_CUSTOMERS.acme.customerNumber;
  const customer: Customer = {
    id: existing?.id ?? CustomerId.parse(newId()),
    organizationId: OrganizationId.DEFAULT,
    name: PHASE1_CUSTOMER_NAME,
    customerNumber,
    creditLimit: Money.fromMinorUnits(
      PHASE1_CUSTOMER_CREDIT_LIMIT_CENTS,
      PHASE1_CUSTOMER_CURRENCY,
    ),
    terms: PHASE1_CUSTOMER_TERMS,
    taxId: existing?.taxId ?? null,
    accountStatus: existing?.accountStatus ?? "active",
    customerNote: existing?.customerNote ?? null,
    staffNote: existing?.staffNote ?? null,
    createdAt: existing?.createdAt ?? new Date(),
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
    roles: withDemoStaffRoles(existing?.roles),
  };
  await ports.staffUsers.save(staff);
  return staff;
}

async function upsertWholesale(
  ports: Phase1SeedPorts,
  customerId: Customer["id"],
  password: string,
): Promise<WholesaleUser> {
  const existing = await ports.wholesaleUsers.findByEmail(
    OrganizationId.DEFAULT,
    PHASE1_WHOLESALE_EMAIL,
  );
  const wholesale: WholesaleUser = {
    id: existing?.id ?? WholesaleUserId.parse(newId()),
    organizationId: OrganizationId.DEFAULT,
    email: PHASE1_WHOLESALE_EMAIL,
    passwordHash: await ports.passwords.hash(password),
    customerId,
  };
  await ports.wholesaleUsers.save(wholesale);
  return wholesale;
}

/**
 * Upsert Phase 1 local/demo rows. Does not write contacts, ship-tos,
 * exemptions, ops users, sessions, stock snapshots, products, or vendors.
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
  await upsertDefaultOrganization(ports.organizations);
  const staff = await upsertStaff(ports, staffPassword);
  const wholesale = await upsertWholesale(ports, customer.id, wholesalePassword);

  return { customer, staff, wholesale };
}
