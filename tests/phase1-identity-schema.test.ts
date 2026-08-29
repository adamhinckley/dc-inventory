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

describe("Phase 1 identity schema (ADA-77)", () => {
  it("keeps identity tables in the identity package and re-exports them from the API barrel", () => {
    expect(existsSync(resolve(root, "packages/identity/src/persistence/schema.ts"))).toBe(
      true,
    );
    const barrel = readText("apps/api/src/infrastructure/schema.ts");
    expect(barrel).toContain("@dc-inventory/identity/schema");
    expect(existsSync(resolve(root, "packages/db"))).toBe(false);
  });

  it("adds password_hash, session customer_id, and last_seen_at without Better Auth tables", () => {
    const schema = readText("packages/identity/src/persistence/schema.ts");
    expect(schema).toMatch(/password_hash/);
    expect(schema).toMatch(/last_seen_at/);
    expect(schema).toMatch(/customer_id/);
    expect(schema).not.toMatch(/betterAuth|better_auth/);
    expect(schema).not.toMatch(/["']role["']/);

    const sql = listSqlMigrations().join("\n");
    expect(sql).toMatch(/password_hash/);
    expect(sql).toMatch(/last_seen_at/);
    expect(sql).not.toMatch(/CREATE TABLE "identity"\."user"/);
    expect(sql).not.toMatch(/CREATE TABLE "identity"\."account"/);
    expect(sql).not.toMatch(/CREATE TABLE "identity"\."verification"/);
  });

  it("persists independent hashed source and account-identifier counters", () => {
    const schema = readText("packages/identity/src/persistence/schema.ts");
    const migration = readText(
      "apps/api/drizzle/migrations/0022_identity_login_throttle.sql",
    );

    for (const source of [schema, migration]) {
      expect(source).toMatch(/login_throttle_counters/);
      expect(source).toMatch(/dimension/);
      expect(source).toMatch(/key_hash/);
      expect(source).toMatch(/attempt_count/);
      expect(source).toMatch(/window_started_at/);
    }
    expect(migration).toMatch(/'source', 'account_identifier'/);
    expect(migration).not.toMatch(/"email"/);
  });
});
