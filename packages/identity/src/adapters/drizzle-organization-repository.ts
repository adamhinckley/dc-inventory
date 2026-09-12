import { OrganizationId } from "@dc-inventory/shared-kernel";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Organization } from "../domain/organization.js";
import { parseOrganizationName } from "../domain/required-text.js";
import type {
  IOrganizationRepository,
  ListOrganizationsQuery,
  OrganizationListPage,
} from "../domain/ports/organization-repository.js";
import { organizations, sessions, staffUsers, wholesaleUsers } from "../persistence/schema.js";

export type OrganizationDrizzle = PostgresJsDatabase<{
  organizations: typeof organizations;
  staffUsers: typeof staffUsers;
  wholesaleUsers: typeof wholesaleUsers;
  sessions: typeof sessions;
}>;

export class DrizzleOrganizationRepository implements IOrganizationRepository {
  constructor(private readonly db: OrganizationDrizzle) {}

  async findBySlug(slug: string): Promise<Organization | null> {
    const rows = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    return rows[0] === undefined ? null : toOrganization(rows[0]);
  }

  async findById(id: OrganizationId): Promise<Organization | null> {
    const rows = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return rows[0] === undefined ? null : toOrganization(rows[0]);
  }

  async save(organization: Organization): Promise<void> {
    const name = parseOrganizationName(organization.name);
    await this.db
      .insert(organizations)
      .values({
        id: organization.id,
        name,
        slug: organization.slug,
      })
      .onConflictDoUpdate({
        target: organizations.id,
        set: { name, slug: organization.slug, updatedAt: new Date() },
      });
  }

  async deleteById(id: OrganizationId): Promise<void> {
    await this.db.delete(organizations).where(eq(organizations.id, id));
  }

  async list(query: ListOrganizationsQuery): Promise<OrganizationListPage> {
    const clauses = [];
    const trimmedQuery = query.q?.trim();
    if (trimmedQuery !== undefined && trimmedQuery.length > 0) {
      const pattern = `%${trimmedQuery}%`;
      clauses.push(or(ilike(organizations.name, pattern), ilike(organizations.slug, pattern))!);
    }
    const where = clauses.length > 0 ? and(...clauses) : undefined;
    const offset = (query.page - 1) * query.pageSize;
    const sortColumn =
      query.sortBy === "slug"
        ? organizations.slug
        : query.sortBy === "id"
          ? organizations.id
          : organizations.name;
    const order = query.sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn);
    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(organizations)
        .where(where)
        .orderBy(order)
        .limit(query.pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(organizations)
        .where(where),
    ]);
    return {
      items: rows.map(toOrganization),
      total: countRows[0]?.count ?? 0,
    };
  }
}

function toOrganization(row: typeof organizations.$inferSelect): Organization {
  return {
    id: OrganizationId.parse(row.id),
    name: row.name,
    slug: row.slug,
  };
}
