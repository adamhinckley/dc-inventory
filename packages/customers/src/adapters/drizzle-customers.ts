import { CustomerId, Money, OrganizationId } from "@dc-inventory/shared-kernel";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
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
import type {
  CustomerListPage,
  ICustomerRepository,
  ListCustomersQuery,
} from "../domain/ports/customer-repository.js";
import type { IContactRepository } from "../domain/ports/contact-repository.js";
import type { IExemptionCertificateRepository } from "../domain/ports/exemption-certificate-repository.js";
import type { IShipToRepository } from "../domain/ports/ship-to-repository.js";
import type { ShipTo } from "../domain/ship-to.js";
import {
  contacts,
  customers,
  exemptionCertificates,
  shipTos,
} from "../persistence/schema.js";

export type CustomersDrizzle = PostgresJsDatabase<{
  customers: typeof customers;
  contacts: typeof contacts;
  shipTos: typeof shipTos;
  exemptionCertificates: typeof exemptionCertificates;
}>;

function toCustomer(row: typeof customers.$inferSelect): Customer {
  return {
    id: CustomerId.parse(row.id),
    organizationId: OrganizationId.parse(row.organizationId),
    name: row.name,
    creditLimit: Money.fromMinorUnits(row.creditLimitCents, row.currency),
    terms: row.terms,
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

export class DrizzleCustomerRepository implements ICustomerRepository {
  constructor(private readonly db: CustomersDrizzle) {}

  async list(query: ListCustomersQuery): Promise<CustomerListPage> {
    const sortColumn =
      query.sortBy === "creditLimitCents"
        ? customers.creditLimitCents
        : query.sortBy === "createdAt"
          ? customers.createdAt
          : customers.name;
    const order = query.sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn);
    const clauses = [eq(customers.organizationId, query.organizationId)];
    if (query.q !== undefined && query.q.trim().length > 0) {
      clauses.push(ilike(customers.name, `%${query.q.trim()}%`));
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

  async save(customer: Customer): Promise<void> {
    await this.db
      .insert(customers)
      .values({
        id: customer.id,
        organizationId: customer.organizationId,
        name: customer.name,
        creditLimitCents: customer.creditLimit.amountMinor,
        currency: customer.creditLimit.currency,
        terms: customer.terms,
      })
      .onConflictDoUpdate({
        target: customers.id,
        set: {
          name: customer.name,
          creditLimitCents: customer.creditLimit.amountMinor,
          currency: customer.creditLimit.currency,
          terms: customer.terms,
          updatedAt: new Date(),
        },
      });
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

export class DrizzleShipToRepository implements IShipToRepository {
  constructor(private readonly db: CustomersDrizzle) {}

  async listByCustomer(customerId: CustomerId): Promise<ShipTo[]> {
    const rows = await this.db
      .select()
      .from(shipTos)
      .where(eq(shipTos.customerId, customerId));
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
    await this.db
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
        isDefault: shipTo.isDefault,
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
          isDefault: shipTo.isDefault,
          updatedAt: new Date(),
        },
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
