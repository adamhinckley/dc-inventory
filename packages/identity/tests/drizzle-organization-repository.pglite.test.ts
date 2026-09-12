import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { OrganizationId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { DrizzleOrganizationRepository } from "../src/adapters/drizzle-organization-repository.js";
import type { OrganizationDrizzle } from "../src/adapters/drizzle-organization-repository.js";
import * as schema from "../src/persistence/schema.js";

const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");

async function createHarness() {
  const client = new PGlite();
  await client.exec(`
    CREATE SCHEMA identity;
    CREATE TABLE identity.organizations (
      id text PRIMARY KEY,
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  const db = drizzle(client, { schema }) as unknown as OrganizationDrizzle;
  const repo = new DrizzleOrganizationRepository(db);
  return { repo };
}

describe("DrizzleOrganizationRepository list SQL (PGlite)", () => {
  it("searches name and slug with pagination and sort", async () => {
    const { repo } = await createHarness();
    await repo.save({ id: OrganizationId.DEFAULT, slug: "acme", name: "Acme Wholesale" });
    await repo.save({ id: BETA_ORG, slug: "beta", name: "Beta Wholesale" });
    await repo.save({
      id: OrganizationId.parse("770e8400-e29b-41d4-a716-446655440088"),
      slug: "harbor",
      name: "Harbor Wholesale",
    });

    const page = await repo.list({
      q: "wholesale",
      page: 1,
      pageSize: 2,
      sortBy: "slug",
      sortOrder: "asc",
    });
    expect(page.total).toBe(3);
    expect(page.items.map((item) => item.slug)).toEqual(["acme", "beta"]);

    const betaOnly = await repo.list({
      q: "beta",
      page: 1,
      pageSize: 25,
      sortBy: "name",
      sortOrder: "desc",
    });
    expect(betaOnly.total).toBe(1);
    expect(betaOnly.items[0]?.id).toBe(BETA_ORG);
  });
});
