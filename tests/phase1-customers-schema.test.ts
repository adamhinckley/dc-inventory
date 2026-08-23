import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

function readText(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function listSqlMigrations(): string[] {
  const dir = resolve(root, "apps/api/drizzle/migrations");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => readText(`apps/api/drizzle/migrations/${name}`));
}

describe("Phase 1 customers schema (ADA-79)", () => {
  it("keeps customers tables in the customers package and re-exports them from the API barrel", () => {
    expect(
      existsSync(resolve(root, "packages/customers/src/persistence/schema.ts")),
    ).toBe(true);
    const barrel = readText("apps/api/src/infrastructure/schema.ts");
    expect(barrel).toContain("@dc-inventory/customers/schema");
    expect(existsSync(resolve(root, "packages/db"))).toBe(false);
  });

  it("lifts contact name/email/phone and nullable exemption object_key without extra contact roles", () => {
    const schema = readText("packages/customers/src/persistence/schema.ts");
    expect(schema).toMatch(/name/);
    expect(schema).toMatch(/email/);
    expect(schema).toMatch(/phone/);
    expect(schema).not.toMatch(/is_primary|isPrimary/);
    expect(schema).not.toMatch(/title/);
    expect(schema).not.toMatch(/["']role["']/);

    const sql = listSqlMigrations().join("\n");
    expect(sql).toMatch(/contacts_customer_id_email_unique/);
    expect(sql).toMatch(/ALTER COLUMN "object_key" DROP NOT NULL/);
  });
});
