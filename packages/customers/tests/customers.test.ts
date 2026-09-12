import { CustomerId, OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { InMemoryBillToRepository } from "../src/adapters/in-memory-bill-to-repository.js";
import { InMemoryContactRepository } from "../src/adapters/in-memory-contact-repository.js";
import { InMemoryCustomerRepository } from "../src/adapters/in-memory-customer-repository.js";
import { InMemoryExemptionCertificateRepository } from "../src/adapters/in-memory-exemption-certificate-repository.js";
import { InMemoryShipToRepository } from "../src/adapters/in-memory-ship-to-repository.js";
import { CreateContactUseCase } from "../src/application/create-contact.js";
import { CreateCustomerUseCase } from "../src/application/create-customer.js";
import { DeleteCustomerUseCase } from "../src/application/delete-customer.js";
import { CreateExemptionCertificateUseCase } from "../src/application/create-exemption-certificate.js";
import { CreateShipToUseCase } from "../src/application/create-ship-to.js";
import { GetCustomerUseCase } from "../src/application/get-customer.js";
import { ListCustomersUseCase } from "../src/application/list-customers.js";
import { UpdateContactUseCase } from "../src/application/update-contact.js";
import { UpdateCustomerUseCase } from "../src/application/update-customer.js";

const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440010");
const OTHER_STAFF = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440011");
const DEFAULT_ORG = OrganizationId.DEFAULT;
const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");

function harness() {
  const customers = new InMemoryCustomerRepository();
  const contacts = new InMemoryContactRepository();
  const shipTos = new InMemoryShipToRepository();
  const billTos = new InMemoryBillToRepository();
  const exemptions = new InMemoryExemptionCertificateRepository();
  return {
    customers,
    contacts,
    shipTos,
    billTos,
    exemptions,
    createCustomer: new CreateCustomerUseCase(customers),
    deleteCustomer: new DeleteCustomerUseCase(
      customers,
      contacts,
      shipTos,
      billTos,
      exemptions,
    ),
    getCustomer: new GetCustomerUseCase(customers),
    listCustomers: new ListCustomersUseCase(customers),
    updateCustomer: new UpdateCustomerUseCase(customers),
    createContact: new CreateContactUseCase(customers, contacts),
    updateContact: new UpdateContactUseCase(customers, contacts),
    createShipTo: new CreateShipToUseCase(customers, shipTos),
    createExemption: new CreateExemptionCertificateUseCase(customers, exemptions),
  };
}

async function createAcme(
  h: ReturnType<typeof harness>,
  name = "Acme Wholesale",
  organizationId = DEFAULT_ORG,
) {
  const created = await h.createCustomer.execute({
    organizationId,
    staffUserId: STAFF_ID,
    name,
    creditLimitCents: 1_000_000,
    currency: "USD",
    terms: "Net 30",
  });
  if (!created.ok) {
    throw new Error("expected create");
  }
  return created.customer;
}

describe("Customers use cases (in-memory)", () => {
  it("creates and lists customers with unused StaffUserId", async () => {
    const h = harness();
    const acme = await createAcme(h);
    await createAcme(h, "Beta Hardware");

    const listed = await h.listCustomers.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: OTHER_STAFF,
      page: 1,
      pageSize: 25,
      sortBy: "name",
      sortOrder: "asc",
    });
    expect(listed.total).toBe(2);
    expect(listed.items.map((row) => row.name)).toEqual([
      "Acme Wholesale",
      "Beta Hardware",
    ]);
    expect(listed.items[0]?.creditLimit.amountMinor).toBe(1_000_000);
    expect(listed.items[0]?.creditLimit.currency).toBe("USD");
    expect(listed.items[0]?.terms).toBe("Net 30");

    const got = await h.getCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: acme.id,
    });
    expect(got).toEqual({ ok: true, customer: acme });
    expect(await h.customers.findByName(DEFAULT_ORG, "Acme Wholesale")).toEqual(acme);
    expect(await h.customers.findByName(DEFAULT_ORG, "  Acme Wholesale  ")).toEqual(acme);
    expect(await h.customers.findByName(DEFAULT_ORG, "missing")).toBeNull();
  });

  it("updates customer fields without a credit formula", async () => {
    const h = harness();
    const acme = await createAcme(h);
    const updated = await h.updateCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: acme.id,
      name: "Acme Wholesale LLC",
      creditLimitCents: 2_000_000,
      terms: "Net 15",
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    expect(updated.customer.name).toBe("Acme Wholesale LLC");
    expect(updated.customer.creditLimit.amountMinor).toBe(2_000_000);
    expect(updated.customer.terms).toBe("Net 15");
  });

  it("rejects a duplicate contact email on the same Customer and allows it on another", async () => {
    const h = harness();
    const acme = await createAcme(h);
    const beta = await createAcme(h, "Beta Hardware");

    const first = await h.createContact.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: acme.id,
      name: "Pat Buyer",
      email: "Pat@Acme.test",
      phone: "555-0100",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.contact.email).toBe("pat@acme.test");
    expect(first.contact.phone).toBe("555-0100");

    const duplicate = await h.createContact.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: acme.id,
      name: "Other Pat",
      email: "pat@acme.test",
    });
    expect(duplicate).toEqual({ ok: false, reason: "duplicate_email" });

    const otherAccount = await h.createContact.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: beta.id,
      name: "Pat Other",
      email: "pat@acme.test",
    });
    expect(otherAccount.ok).toBe(true);

    const clashOnUpdate = await h.createContact.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: acme.id,
      name: "Sam",
      email: "sam@acme.test",
    });
    if (!clashOnUpdate.ok) {
      throw new Error("expected second contact");
    }
    const updated = await h.updateContact.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: acme.id,
      contactId: clashOnUpdate.contact.id,
      email: "pat@acme.test",
    });
    expect(updated).toEqual({ ok: false, reason: "duplicate_email" });
  });

  it("allows an exemption certificate without object_key", async () => {
    const h = harness();
    const acme = await createAcme(h);
    const created = await h.createExemption.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: acme.id,
      jurisdiction: "UT",
      status: "on_file",
      entityUseCode: null,
      expiresAt: null,
      objectKey: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.certificate.objectKey).toBeNull();
    expect(created.certificate.jurisdiction).toBe("UT");
    expect(created.certificate.entityUseCode).toBeNull();
  });

  it("creates a ship-to with Phase 0 address columns", async () => {
    const h = harness();
    const acme = await createAcme(h);
    const created = await h.createShipTo.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: acme.id,
      line1: "100 Warehouse Rd",
      line2: null,
      city: "Ogden",
      region: "UT",
      postal: "84401",
      country: "US",
      isDefault: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.shipTo.line1).toBe("100 Warehouse Rd");
    expect(created.shipTo.line2).toBeNull();
    expect(created.shipTo.isDefault).toBe(true);
  });

  it("scopes customers by organizationId and allows duplicate names across orgs", async () => {
    const h = harness();
    const acme = await createAcme(h, "Acme Retail", DEFAULT_ORG);
    const beta = await createAcme(h, "Acme Retail", BETA_ORG);
    expect(acme.id).not.toEqual(beta.id);

    const acmeList = await h.listCustomers.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
      sortBy: "name",
      sortOrder: "asc",
    });
    expect(acmeList.total).toBe(1);
    expect(acmeList.items[0]?.name).toBe("Acme Retail");

    const crossOrgGet = await h.getCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: beta.id,
    });
    expect(crossOrgGet).toEqual({ ok: false, reason: "not_found" });

    const acmeContact = await h.createContact.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: acme.id,
      name: "Buyer",
      email: "buyer@acme.test",
    });
    const betaContact = await h.createContact.execute({
      organizationId: BETA_ORG,
      staffUserId: STAFF_ID,
      customerId: beta.id,
      name: "Buyer",
      email: "buyer@acme.test",
    });
    expect(acmeContact.ok).toBe(true);
    expect(betaContact.ok).toBe(true);
  });

  it("deletes a customer and its address book rows", async () => {
    const h = harness();
    const acme = await createAcme(h);
    await h.createContact.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: acme.id,
      name: "Buyer",
      email: "buyer@acme.test",
    });
    await h.createShipTo.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: acme.id,
      line1: "123 Main",
      city: "Ogden",
      region: "UT",
      postal: "84401",
      country: "US",
      isDefault: true,
    });
    await h.createExemption.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: acme.id,
      jurisdiction: "UT",
      status: "on_file",
    });
    await h.billTos.save({
      customerId: acme.id,
      line1: "123 Main",
      line2: null,
      city: "Ogden",
      region: "UT",
      postal: "84401",
      country: "US",
    });

    expect(await h.deleteCustomer.execute({
      organizationId: DEFAULT_ORG,
      customerId: acme.id,
    })).toEqual({ ok: true });
    expect(await h.customers.findById(DEFAULT_ORG, acme.id)).toBeNull();
    expect(await h.contacts.listByCustomer(acme.id)).toEqual([]);
    expect(await h.shipTos.listByCustomer(acme.id)).toEqual([]);
    expect(await h.exemptions.listByCustomer(acme.id)).toEqual([]);
    expect(await h.billTos.findByCustomerId(acme.id)).toBeNull();

    expect(await h.deleteCustomer.execute({
      organizationId: DEFAULT_ORG,
      customerId: acme.id,
    })).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns not_found for a missing customer and does not invent wholesale-user create", async () => {
    const h = harness();
    const missing = CustomerId.parse("550e8400-e29b-41d4-a716-446655440099");
    const contact = await h.createContact.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: missing,
      name: "Nobody",
      email: "nobody@example.test",
    });
    expect(contact).toEqual({ ok: false, reason: "not_found" });
    const source = readFileSync(
      resolve(import.meta.dirname, "../src/application/create-customer.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/wholesale/i);
  });

  it("keeps application/ free of Fastify, Drizzle, Zod, and adapter SDKs", () => {
    const dir = resolve(import.meta.dirname, "../src/application");
    const forbidden = /fastify|drizzle|zod|minio|better-auth|identity/i;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".ts")) {
        continue;
      }
      const source = readFileSync(resolve(dir, name), "utf8");
      expect(source, name).not.toMatch(forbidden);
    }
  });
});
