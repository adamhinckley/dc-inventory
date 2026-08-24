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

describe("Phase 2 inventory ledger schema (ADA-108)", () => {
  it("registers inventory tables from the Inventory package schema barrel", () => {
    const barrel = readText("apps/api/src/infrastructure/schema.ts");
    expect(barrel).toMatch(/@dc-inventory\/inventory\/schema/);
    expect(existsSync(resolve(root, "packages/inventory/src/persistence/schema.ts"))).toBe(true);
    expect(existsSync(resolve(root, "apps/api/src/infrastructure/schema/inventory.ts"))).toBe(
      false,
    );
  });

  it("adds ledger identity columns and constraints in migrations 0005–0006", () => {
    const enumSql = readText("apps/api/drizzle/migrations/0005_inventory_ledger_enum_values.sql");
    const identitySql = readText("apps/api/drizzle/migrations/0006_inventory_ledger_identity.sql");
    expect(enumSql).toMatch(/InboundCancelled/);
    expect(enumSql).toMatch(/AdjustmentIncrease/);
    expect(enumSql).toMatch(/AdjustmentDecrease/);
    expect(enumSql).toMatch(/adjustment/);
    expect(identitySql).toMatch(/idempotency_key/i);
    expect(identitySql).toMatch(/stock_movements_idempotency_key_sku/i);
    expect(identitySql).toMatch(/stock_movements_once_only_provenance/i);
    expect(identitySql).toMatch(/qty" > 0|"qty" > 0/i);
  });

  it("keeps generated available and movement enums aligned with ADA-105", () => {
    const schema = readText("packages/inventory/src/persistence/schema.ts");
    expect(schema).toMatch(/InboundFromPo/);
    expect(schema).toMatch(/GoodsReceived/);
    expect(schema).toMatch(/InboundCancelled/);
    expect(schema).toMatch(/AdjustmentIncrease/);
    expect(schema).toMatch(/AdjustmentDecrease/);
    expect(schema).not.toMatch(/"Adjustment"/);
    expect(schema).toMatch(/generatedAlwaysAs\(sql`on_hand - allocated`\)/);
    expect(listSqlMigrations().join("\n")).toMatch(
      /available[^,\n]*GENERATED ALWAYS AS \(on_hand - allocated\) STORED/i,
    );
  });
});
