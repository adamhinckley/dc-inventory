import { OrganizationId, StaffUserId, WholesaleUserId } from "@dc-inventory/shared-kernel";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CustomerAccountStatusReadAdapter } from "../src/adapters/customer-account-status-read.js";
import { CustomerBillToSnapshotReadAdapter } from "../src/adapters/customer-bill-to-snapshot-read.js";
import { InMemoryBillToRepository } from "../src/adapters/in-memory-bill-to-repository.js";
import { InMemoryContactRepository } from "../src/adapters/in-memory-contact-repository.js";
import { InMemoryCustomerRepository } from "../src/adapters/in-memory-customer-repository.js";
import { InMemoryExemptionCertificateRepository } from "../src/adapters/in-memory-exemption-certificate-repository.js";
import { InMemoryShipToRepository } from "../src/adapters/in-memory-ship-to-repository.js";
import { CopyBillToFromDefaultShipToUseCase } from "../src/application/copy-bill-to-from-default-ship-to.js";
import { CreateBillToUseCase } from "../src/application/create-bill-to.js";
import { CreateContactUseCase } from "../src/application/create-contact.js";
import { CreateCustomerUseCase } from "../src/application/create-customer.js";
import { CreateExemptionCertificateUseCase } from "../src/application/create-exemption-certificate.js";
import { CreateShipToUseCase } from "../src/application/create-ship-to.js";
import { UpdateCustomerUseCase } from "../src/application/update-customer.js";
import { UpdateWholesaleCustomerNoteUseCase } from "../src/application/update-wholesale-customer-note.js";

const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440010");
const DEFAULT_ORG = OrganizationId.DEFAULT;
const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");

function harness() {
  const customers = new InMemoryCustomerRepository();
  const shipTos = new InMemoryShipToRepository();
  const billTos = new InMemoryBillToRepository();
  const contacts = new InMemoryContactRepository();
  const exemptions = new InMemoryExemptionCertificateRepository();
  return {
    customers,
    shipTos,
    billTos,
    contacts,
    exemptions,
    createCustomer: new CreateCustomerUseCase(customers),
    updateCustomer: new UpdateCustomerUseCase(customers),
    createContact: new CreateContactUseCase(customers, contacts),
    createExemption: new CreateExemptionCertificateUseCase(customers, exemptions),
    createShipTo: new CreateShipToUseCase(customers, shipTos),
    createBillTo: new CreateBillToUseCase(customers, billTos),
    copyBillTo: new CopyBillToFromDefaultShipToUseCase(customers, shipTos, billTos),
    updateWholesaleNote: new UpdateWholesaleCustomerNoteUseCase(customers),
    billToSnapshot: new CustomerBillToSnapshotReadAdapter(customers, billTos),
    accountStatus: new CustomerAccountStatusReadAdapter(customers),
  };
}

describe("Customer master invariants U5–U14", () => {
  it("U5: first save requires name, terms, credit limit; blank number issues CUST-#####; status defaults active", async () => {
    const h = harness();
    const missingTerms = await h.createCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Acme",
      creditLimitCents: 0,
      terms: "   ",
    });
    expect(missingTerms).toEqual({ ok: false, reason: "invalid" });

    const created = await h.createCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Acme Wholesale",
      creditLimitCents: 0,
      terms: "Net 30",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.customer.customerNumber).toBe("CUST-00001");
    expect(created.customer.accountStatus).toBe("active");
    expect(created.customer.creditLimit.amountMinor).toBe(0);
  });

  it("U5/U6: staff legacy customer number is stored and unique per organization", async () => {
    const h = harness();
    const legacy = await h.createCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Legacy Import",
      creditLimitCents: 100,
      terms: "Net 30",
      customerNumber: "LEGACY-42",
    });
    expect(legacy.ok).toBe(true);
    if (!legacy.ok) {
      return;
    }
    expect(legacy.customer.customerNumber).toBe("LEGACY-42");

    const duplicate = await h.createCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Other",
      creditLimitCents: 100,
      terms: "Net 30",
      customerNumber: "LEGACY-42",
    });
    expect(duplicate).toEqual({ ok: false, reason: "duplicate_customer_number" });

    const beta = await h.createCustomer.execute({
      organizationId: BETA_ORG,
      staffUserId: STAFF_ID,
      name: "Beta Legacy",
      creditLimitCents: 100,
      terms: "Net 30",
      customerNumber: "LEGACY-42",
    });
    expect(beta.ok).toBe(true);
  });

  it("U6: customer number is immutable after first save", async () => {
    const h = harness();
    const created = await h.createCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Immutable Co",
      creditLimitCents: 100,
      terms: "Net 30",
      customerNumber: "LEGACY-99",
    });
    if (!created.ok) {
      throw new Error("expected create");
    }
    const updated = await h.updateCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: created.customer.id,
      name: "Immutable Co LLC",
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    expect(updated.customer.customerNumber).toBe("LEGACY-99");
  });

  it("U7: customer may have zero bill-tos; snapshot read port returns null until one exists", async () => {
    const h = harness();
    const created = await h.createCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "No Bill-To Yet",
      creditLimitCents: 100,
      terms: "Net 30",
    });
    if (!created.ok) {
      throw new Error("expected create");
    }
    expect(
      await h.billToSnapshot.getBillToAddressSnapshot(DEFAULT_ORG, created.customer.id),
    ).toBeNull();

    const billTo = await h.createBillTo.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: created.customer.id,
      line1: "1 Billing Rd",
      city: "Ogden",
      region: "UT",
      postal: "84401",
      country: "US",
    });
    expect(billTo.ok).toBe(true);
    if (!billTo.ok) {
      return;
    }
    expect(
      await h.billToSnapshot.getBillToAddressSnapshot(DEFAULT_ORG, created.customer.id),
    ).toEqual({
      line1: "1 Billing Rd",
      line2: null,
      city: "Ogden",
      region: "UT",
      postal: "84401",
      country: "US",
    });
  });

  it("U8: bill-to snapshot exposes six address fields for downstream invoice copy", async () => {
    const h = harness();
    const created = await h.createCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Invoice Snapshot",
      creditLimitCents: 100,
      terms: "Net 30",
    });
    if (!created.ok) {
      throw new Error("expected create");
    }
    await h.createBillTo.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: created.customer.id,
      line1: "500 Invoice Ave",
      line2: "Suite 2",
      city: "Salt Lake City",
      region: "UT",
      postal: "84101",
      country: "US",
    });
    const snapshot = await h.billToSnapshot.getBillToAddressSnapshot(
      DEFAULT_ORG,
      created.customer.id,
    );
    expect(snapshot).toMatchObject({
      line1: "500 Invoice Ave",
      line2: "Suite 2",
      city: "Salt Lake City",
      region: "UT",
      postal: "84101",
      country: "US",
    });
    expect(Object.keys(snapshot ?? {})).toEqual([
      "line1",
      "line2",
      "city",
      "region",
      "postal",
      "country",
    ]);
  });

  it("U9: copy-from-default-ship-to duplicates six fields independently", async () => {
    const h = harness();
    const created = await h.createCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Ship Copy",
      creditLimitCents: 100,
      terms: "Net 30",
    });
    if (!created.ok) {
      throw new Error("expected create");
    }
    await h.createShipTo.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: created.customer.id,
      line1: "100 Warehouse Rd",
      line2: null,
      city: "Ogden",
      region: "UT",
      postal: "84401",
      country: "US",
      isDefault: true,
    });
    const copied = await h.copyBillTo.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: created.customer.id,
    });
    expect(copied.ok).toBe(true);
    if (!copied.ok) {
      return;
    }
    expect(copied.billTo.line1).toBe("100 Warehouse Rd");
    expect(copied.billTo.city).toBe("Ogden");
  });

  it("U11: customer note and staff note are separate; wholesale edits customer note only", async () => {
    const h = harness();
    const created = await h.createCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Notes Co",
      creditLimitCents: 100,
      terms: "Net 30",
      customerNote: "Buyer-facing",
      staffNote: "Internal only",
    });
    if (!created.ok) {
      throw new Error("expected create");
    }
    expect(created.customer.customerNote).toBe("Buyer-facing");
    expect(created.customer.staffNote).toBe("Internal only");

    const wholesale = await h.updateWholesaleNote.execute({
      organizationId: DEFAULT_ORG,
      wholesaleUserId: WholesaleUserId.parse("550e8400-e29b-41d4-a716-446655440099"),
      customerId: created.customer.id,
      customerNote: "Updated by buyer",
    });
    expect(wholesale.ok).toBe(true);
    if (!wholesale.ok) {
      return;
    }
    expect(wholesale.customer.customerNote).toBe("Updated by buyer");
    expect(wholesale.customer.staffNote).toBe("Internal only");
  });

  it("U12: customer header has no taxStatus field", async () => {
    const h = harness();
    const created = await h.createCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Reseller",
      creditLimitCents: 100,
      terms: "Net 30",
      taxId: "12-3456789",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.customer).not.toHaveProperty("taxStatus");
    expect(created.customer.taxId).toBe("12-3456789");
  });

  it("U13: exemption certificates are not a create, bill-to, or ship-to gate", async () => {
    const h = harness();
    const created = await h.createCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "No Cert Gate",
      creditLimitCents: 100,
      terms: "Net 30",
    });
    if (!created.ok) {
      throw new Error("expected create");
    }

    const shipToWithoutCert = await h.createShipTo.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: created.customer.id,
      line1: "1 Ship Ln",
      city: "Ogden",
      region: "UT",
      postal: "84401",
      country: "US",
      isDefault: true,
    });
    expect(shipToWithoutCert.ok).toBe(true);

    const billToWithoutCert = await h.createBillTo.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: created.customer.id,
      line1: "2 Bill Ln",
      city: "Ogden",
      region: "UT",
      postal: "84401",
      country: "US",
    });
    expect(billToWithoutCert.ok).toBe(true);

    const expired = await h.createExemption.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: created.customer.id,
      jurisdiction: "UT",
      status: "expired",
      entityUseCode: null,
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      objectKey: null,
    });
    expect(expired.ok).toBe(true);

    const billToAfterExpired = await h.updateCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: created.customer.id,
      customerNote: "Still operable",
    });
    expect(billToAfterExpired.ok).toBe(true);
    expect(
      await h.billToSnapshot.getBillToAddressSnapshot(DEFAULT_ORG, created.customer.id),
    ).not.toBeNull();

    const applicationDir = resolve(import.meta.dirname, "../src/application");
    const forbiddenGate = /exemption|certificate|expires_at|expired/i;
    for (const name of ["create-customer.ts", "create-bill-to.ts", "create-ship-to.ts"]) {
      const source = readFileSync(resolve(applicationDir, name), "utf8");
      expect(source, name).not.toMatch(forbiddenGate);
    }
  });

  it("U14: contact email is per-customer correspondence, not wholesale login", async () => {
    const h = harness();
    const acme = await h.createCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Acme Wholesale",
      creditLimitCents: 100,
      terms: "Net 30",
    });
    const beta = await h.createCustomer.execute({
      organizationId: BETA_ORG,
      staffUserId: STAFF_ID,
      name: "Beta Wholesale",
      creditLimitCents: 100,
      terms: "Net 30",
    });
    if (!acme.ok || !beta.ok) {
      throw new Error("expected customers");
    }

    const wholesaleStyleEmail = "wholesale@local.test";
    const acmeContact = await h.createContact.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: acme.customer.id,
      name: "Shop Contact",
      email: wholesaleStyleEmail,
    });
    const betaContact = await h.createContact.execute({
      organizationId: BETA_ORG,
      staffUserId: STAFF_ID,
      customerId: beta.customer.id,
      name: "Other Shop Contact",
      email: wholesaleStyleEmail,
    });
    expect(acmeContact.ok).toBe(true);
    expect(betaContact.ok).toBe(true);
    if (!acmeContact.ok || !betaContact.ok) {
      return;
    }
    expect(acmeContact.contact.email).toBe(wholesaleStyleEmail);
    expect(betaContact.contact.email).toBe(wholesaleStyleEmail);
    expect(acmeContact.contact.customerId).toBe(acme.customer.id);
    expect(betaContact.contact.customerId).toBe(beta.customer.id);

    const createContactSource = readFileSync(
      resolve(import.meta.dirname, "../src/application/create-contact.ts"),
      "utf8",
    );
    expect(createContactSource).not.toMatch(/wholesale|identity|login|session/i);
  });

  it("exports account status read port for downstream gates", async () => {
    const h = harness();
    const created = await h.createCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "On Hold Co",
      creditLimitCents: 100,
      terms: "Net 30",
      accountStatus: "on_hold",
    });
    if (!created.ok) {
      throw new Error("expected create");
    }
    expect(
      await h.accountStatus.getAccountStatus(DEFAULT_ORG, created.customer.id),
    ).toBe("on_hold");
  });
});
