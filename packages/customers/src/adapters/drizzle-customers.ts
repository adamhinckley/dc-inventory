import { CustomerId, Money, OrganizationId } from "@dc-inventory/shared-kernel";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Contact } from "../domain/contact.js";
import type { Customer } from "../domain/customer.js";
import { normalizeEmail } from "../domain/email.js";
import type { ExemptionCertificate } from "../domain/exemption-certificate.js";
import {
  ContactId,
  ExemptionCertificateId,
  ShipToId,
} from "../domain/ids.js";
import type { BillTo } from "../domain/bill-to.js";
import type { AccountStatus } from "../domain/account-status.js";
import {
  formatCustomerNumber,
  parseCustomerNumberSequence,
} from "../domain/document-number.js";
import type {
  CustomerListPage,
  ICustomerRepository,
  ListCustomersQuery,
} from "../domain/ports/customer-repository.js";
import type { IContactRepository } from "../domain/ports/contact-repository.js";
import type { IExemptionCertificateRepository } from "../domain/ports/exemption-certificate-repository.js";
import type { IBillToRepository } from "../domain/ports/bill-to-repository.js";
import type { IShipToRepository } from "../domain/ports/ship-to-repository.js";
import type { ShipTo } from "../domain/ship-to.js";
import {
  billTos,
  contacts,
  customers,
  documentNumberCounters,
  exemptionCertificates,
  shipTos,
} from "../persistence/schema.js";

export type CustomersDrizzle = PostgresJsDatabase<{
  customers: typeof customers;
  contacts: typeof contacts;
  shipTos: typeof shipTos;
  billTos: typeof billTos;
  exemptionCertificates: typeof exemptionCertificates;
  documentNumberCounters: typeof documentNumberCounters;
}>;

function toAccountStatus(value: string): AccountStatus {
  if (value === "active" || value === "on_hold" || value === "inactive") {
    return value;
  }
  return "active";
}

function toCustomer(row: typeof customers.$inferSelect): Customer {
  return {
    id: CustomerId.parse(row.id),
    organizationId: OrganizationId.parse(row.organizationId),
    name: row.name,
    customerNumber: row.customerNumber,
    creditLimit: Money.fromMinorUnits(row.creditLimitCents, row.currency),
    terms: row.terms,
    taxId: row.taxId,
    accountStatus: toAccountStatus(row.accountStatus),
    customerNote: row.customerNote,
    staffNote: row.staffNote,
    createdAt: row.createdAt,
  };
}

function toContact(row: typeof contacts.$inferSelect): Contact {
  return {
    id: ContactId.parse(row.id),
    customerId: CustomerId.parse(row.customerId),
    name: row.name,
    email: row.email,
    phone: row.phone,
  };
}

function toShipTo(row: typeof shipTos.$inferSelect): ShipTo {
  return {
    id: ShipToId.parse(row.id),
    customerId: CustomerId.parse(row.customerId),
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    region: row.region,
    postal: row.postal,
    country: row.country,
    isDefault: row.isDefault,
  };
}

function toBillTo(row: typeof billTos.$inferSelect): BillTo {
  return {
    customerId: CustomerId.parse(row.customerId),
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    region: row.region,
    postal: row.postal,
    country: row.country,
  };
}

function toExemption(
  row: typeof exemptionCertificates.$inferSelect,
): ExemptionCertificate {
  return {
    id: ExemptionCertificateId.parse(row.id),
    customerId: CustomerId.parse(row.customerId),
    objectKey: row.objectKey,
    jurisdiction: row.jurisdiction,
    entityUseCode: row.entityUseCode,
    expiresAt: row.expiresAt,
    status: row.status,
  };
}

async function allocateCustomerNumber(
  db: CustomersDrizzle,
  organizationId: OrganizationId,
): Promise<string> {
  const rows = await db
    .insert(documentNumberCounters)
    .values({ organizationId, lastValue: 1 })
    .onConflictDoUpdate({
      target: documentNumberCounters.organizationId,
      set: { lastValue: sql`${documentNumberCounters.lastValue} + 1` },
    })
    .returning({ sequence: documentNumberCounters.lastValue });
  const sequence = rows[0]?.sequence;
  if (sequence === undefined) {
    throw new Error("Failed to allocate customer number");
  }
  return formatCustomerNumber(sequence);
}

async function advanceCustomerCounter(
  db: CustomersDrizzle,
  organizationId: OrganizationId,
  customerNumber: string,
): Promise<void> {
  const sequence = parseCustomerNumberSequence(customerNumber);
  if (sequence === null || sequence < 1) {
    return;
  }
  await db
    .insert(documentNumberCounters)
    .values({ organizationId, lastValue: sequence })
    .onConflictDoUpdate({
      target: documentNumberCounters.organizationId,
      set: {
        lastValue: sql`greatest(${documentNumberCounters.lastValue}, ${sequence})`,
      },
    });
}

export class DrizzleCustomerRepository implements ICustomerRepository {
  constructor(private readonly db: CustomersDrizzle) {}

  async list(query: ListCustomersQuery): Promise<CustomerListPage> {
    const sortColumn =
      query.sortBy === "creditLimitCents"
        ? customers.creditLimitCents
        : query.sortBy === "createdAt"
          ? customers.createdAt
          : query.sortBy === "customerNumber"
            ? customers.customerNumber
            : customers.name;
    const order = query.sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn);
    const clauses = [eq(customers.organizationId, query.organizationId)];
    if (query.q !== undefined && query.q.trim().length > 0) {
      const needle = `%${query.q.trim()}%`;
      clauses.push(or(ilike(customers.name, needle), ilike(customers.customerNumber, needle))!);
    }
    if (query.accountStatus !== undefined) {
      clauses.push(eq(customers.accountStatus, query.accountStatus));
    }
    const where = and(...clauses);
    const offset = (query.page - 1) * query.pageSize;
    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(customers)
        .where(where)
        .orderBy(order)
        .limit(query.pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(customers)
        .where(where),
    ]);
    return {
      items: rows.map(toCustomer),
      total: countRows[0]?.count ?? 0,
    };
  }

  async findById(organizationId: OrganizationId, id: CustomerId): Promise<Customer | null> {
    const rows = await this.db
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)))
      .limit(1);
    return rows[0] === undefined ? null : toCustomer(rows[0]);
  }

  async findByName(organizationId: OrganizationId, name: string): Promise<Customer | null> {
    const needle = name.trim();
    if (needle.length === 0) {
      return null;
    }
    const rows = await this.db
      .select()
      .from(customers)
      .where(and(eq(customers.organizationId, organizationId), eq(customers.name, needle)))
      .limit(1);
    return rows[0] === undefined ? null : toCustomer(rows[0]);
  }

  async findByCustomerNumber(
    organizationId: OrganizationId,
    customerNumber: string,
  ): Promise<Customer | null> {
    const needle = customerNumber.trim();
    if (needle.length === 0) {
      return null;
    }
    const rows = await this.db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.organizationId, organizationId),
          eq(customers.customerNumber, needle),
        ),
      )
      .limit(1);
    return rows[0] === undefined ? null : toCustomer(rows[0]);
  }

  async allocateNextCustomerNumber(organizationId: OrganizationId): Promise<string> {
    return allocateCustomerNumber(this.db, organizationId);
  }

  async save(customer: Customer): Promise<void> {
    await this.db
      .insert(customers)
      .values({
        id: customer.id,
        organizationId: customer.organizationId,
        name: customer.name,
        customerNumber: customer.customerNumber,
        creditLimitCents: customer.creditLimit.amountMinor,
        currency: customer.creditLimit.currency,
        terms: customer.terms,
        taxId: customer.taxId,
        accountStatus: customer.accountStatus,
        customerNote: customer.customerNote,
        staffNote: customer.staffNote,
        createdAt: customer.createdAt,
      })
      .onConflictDoUpdate({
        target: customers.id,
        set: {
          name: customer.name,
          creditLimitCents: customer.creditLimit.amountMinor,
          currency: customer.creditLimit.currency,
          terms: customer.terms,
          taxId: customer.taxId,
          accountStatus: customer.accountStatus,
          customerNote: customer.customerNote,
          staffNote: customer.staffNote,
          updatedAt: new Date(),
        },
      });
    await advanceCustomerCounter(this.db, customer.organizationId, customer.customerNumber);
  }
}

export class DrizzleBillToRepository implements IBillToRepository {
  constructor(private readonly db: CustomersDrizzle) {}

  async findByCustomerId(customerId: CustomerId): Promise<BillTo | null> {
    const rows = await this.db
      .select()
      .from(billTos)
      .where(eq(billTos.customerId, customerId))
      .limit(1);
    return rows[0] === undefined ? null : toBillTo(rows[0]);
  }

  async save(billTo: BillTo): Promise<void> {
    await this.db
      .insert(billTos)
      .values({
        customerId: billTo.customerId,
        line1: billTo.line1,
        line2: billTo.line2,
        city: billTo.city,
        region: billTo.region,
        postal: billTo.postal,
        country: billTo.country,
      })
      .onConflictDoUpdate({
        target: billTos.customerId,
        set: {
          line1: billTo.line1,
          line2: billTo.line2,
          city: billTo.city,
          region: billTo.region,
          postal: billTo.postal,
          country: billTo.country,
          updatedAt: new Date(),
        },
      });
  }

  async deleteByCustomerId(customerId: CustomerId): Promise<void> {
    await this.db.delete(billTos).where(eq(billTos.customerId, customerId));
  }
}

export class DrizzleContactRepository implements IContactRepository {
  constructor(private readonly db: CustomersDrizzle) {}

  async listByCustomer(customerId: CustomerId): Promise<Contact[]> {
    const rows = await this.db
      .select()
      .from(contacts)
      .where(eq(contacts.customerId, customerId));
    return rows.map(toContact);
  }

  async findById(id: ContactId): Promise<Contact | null> {
    const rows = await this.db
      .select()
      .from(contacts)
      .where(eq(contacts.id, id))
      .limit(1);
    return rows[0] === undefined ? null : toContact(rows[0]);
  }

  async findByCustomerAndEmail(
    customerId: CustomerId,
    email: string,
  ): Promise<Contact | null> {
    const rows = await this.db
      .select()
      .from(contacts)
      .where(
        and(eq(contacts.customerId, customerId), eq(contacts.email, normalizeEmail(email))),
      )
      .limit(1);
    return rows[0] === undefined ? null : toContact(rows[0]);
  }

  async save(contact: Contact): Promise<void> {
    const email = normalizeEmail(contact.email);
    await this.db
      .insert(contacts)
      .values({
        id: contact.id,
        customerId: contact.customerId,
        name: contact.name,
        email,
        phone: contact.phone,
      })
      .onConflictDoUpdate({
        target: contacts.id,
        set: {
          name: contact.name,
          email,
          phone: contact.phone,
          updatedAt: new Date(),
        },
      });
  }
}

export function buildShipToListByCustomerQuery(
  db: CustomersDrizzle,
  customerId: CustomerId,
) {
  return db
    .select()
    .from(shipTos)
    .where(eq(shipTos.customerId, customerId))
    .orderBy(asc(shipTos.createdAt), asc(shipTos.id));
}

export class DrizzleShipToRepository implements IShipToRepository {
  constructor(private readonly db: CustomersDrizzle) {}

  async listByCustomer(customerId: CustomerId): Promise<ShipTo[]> {
    const rows = await buildShipToListByCustomerQuery(this.db, customerId);
    return rows.map(toShipTo);
  }

  async findById(id: ShipToId): Promise<ShipTo | null> {
    const rows = await this.db
      .select()
      .from(shipTos)
      .where(eq(shipTos.id, id))
      .limit(1);
    return rows[0] === undefined ? null : toShipTo(rows[0]);
  }

  async save(shipTo: ShipTo): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .insert(shipTos)
        .values({
          id: shipTo.id,
          customerId: shipTo.customerId,
          line1: shipTo.line1,
          line2: shipTo.line2,
          city: shipTo.city,
          region: shipTo.region,
          postal: shipTo.postal,
          country: shipTo.country,
          isDefault: shipTo.isDefault ? false : shipTo.isDefault,
        })
        .onConflictDoUpdate({
          target: shipTos.id,
          set: {
            line1: shipTo.line1,
            line2: shipTo.line2,
            city: shipTo.city,
            region: shipTo.region,
            postal: shipTo.postal,
            country: shipTo.country,
            isDefault: shipTo.isDefault ? false : shipTo.isDefault,
            updatedAt: new Date(),
          },
        });

      if (shipTo.isDefault) {
        await tx
          .update(shipTos)
          .set({
            isDefault: sql`(${shipTos.id} = ${shipTo.id})`,
            updatedAt: new Date(),
          })
          .where(eq(shipTos.customerId, shipTo.customerId));
      }
    });
  }
}

export class DrizzleExemptionCertificateRepository
  implements IExemptionCertificateRepository
{
  constructor(private readonly db: CustomersDrizzle) {}

  async listByCustomer(customerId: CustomerId): Promise<ExemptionCertificate[]> {
    const rows = await this.db
      .select()
      .from(exemptionCertificates)
      .where(eq(exemptionCertificates.customerId, customerId));
    return rows.map(toExemption);
  }

  async findById(id: ExemptionCertificateId): Promise<ExemptionCertificate | null> {
    const rows = await this.db
      .select()
      .from(exemptionCertificates)
      .where(eq(exemptionCertificates.id, id))
      .limit(1);
    return rows[0] === undefined ? null : toExemption(rows[0]);
  }

  async save(certificate: ExemptionCertificate): Promise<void> {
    await this.db
      .insert(exemptionCertificates)
      .values({
        id: certificate.id,
        customerId: certificate.customerId,
        objectKey: certificate.objectKey,
        jurisdiction: certificate.jurisdiction,
        entityUseCode: certificate.entityUseCode,
        expiresAt: certificate.expiresAt,
        status: certificate.status,
      })
      .onConflictDoUpdate({
        target: exemptionCertificates.id,
        set: {
          objectKey: certificate.objectKey,
          jurisdiction: certificate.jurisdiction,
          entityUseCode: certificate.entityUseCode,
          expiresAt: certificate.expiresAt,
          status: certificate.status,
          updatedAt: new Date(),
        },
      });
  }
}
