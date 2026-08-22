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

function schemaSources(): string {
  const files = [
    "apps/api/src/infrastructure/schema.ts",
    "apps/api/src/infrastructure/schema/licensing.ts",
    "apps/api/src/infrastructure/schema/operator-bridge.ts",
  ];
  return files
    .filter((path) => existsSync(resolve(root, path)))
    .map((path) => readText(path))
    .join("\n");
}

function tableSql(sql: string, schema: string, table: string): string {
  return (
    sql.match(
      new RegExp(`CREATE TABLE "${schema}"\\."${table}" \\([\\s\\S]*?\\);`),
    )?.[0] ?? ""
  );
}

function schemaSql(sql: string, schema: string): string {
  const tables = [
    ...sql.matchAll(
      new RegExp(`CREATE TABLE "${schema}"\\."[^"]+" \\([\\s\\S]*?\\);`, "g"),
    ),
  ]
    .map((match) => match[0])
    .join("\n");
  const types = [
    ...sql.matchAll(
      new RegExp(`CREATE TYPE "${schema}"\\."[^"]+" AS ENUM\\([^)]+\\);`, "g"),
    ),
  ]
    .map((match) => match[0])
    .join("\n");
  const alters = [
    ...sql.matchAll(
      new RegExp(`ALTER TABLE "${schema}"\\."[^"]+"[\\s\\S]*?;`, "g"),
    ),
  ]
    .map((match) => match[0])
    .join("\n");
  const indexes = [
    ...sql.matchAll(
      new RegExp(
        `CREATE(?: UNIQUE)? INDEX[^;]*"${schema}"\\."[^"]+"[^;]*;`,
        "g",
      ),
    ),
    ...sql.matchAll(
      new RegExp(
        `CREATE(?: UNIQUE)? INDEX[^;]* ON "${schema}"\\."[^"]+"[^;]*;`,
        "g",
      ),
    ),
  ]
    .map((match) => match[0])
    .join("\n");
  return [types, tables, alters, indexes].join("\n");
}

const inventedLeftovers = [
  "stripe_customer",
  "stripe_event",
  "stripe_price",
  "invoice_id",
  "kafka",
  "inventory_outbox",
  "order.placed",
];

describe("Phase 0 licensing / operator_bridge schemas (ADA-54)", () => {
  it("registers licensing and operator-bridge tables in the API Kit schema barrel", () => {
    const barrel = readText("apps/api/src/infrastructure/schema.ts");
    expect(barrel).toMatch(/subscriptions/);
    expect(barrel).toMatch(/addOnGrants|add_on_grants/);
    expect(barrel).toMatch(/flagOverrides|flag_overrides/);
    expect(barrel).toMatch(/softwarePayments|software_payments/);
    expect(barrel).toMatch(/issueReports|issue_reports/);
    expect(barrel).toMatch(/operatorOutbox|operator_outbox/);
    expect(existsSync(resolve(root, "packages/db"))).toBe(false);
  });

  it("defines subscriptions, add-on grants, and flag overrides without a FeatureName catalog", () => {
    const sources = schemaSources();
    const sql = listSqlMigrations().join("\n");
    const licensing = schemaSql(sql, "licensing");

    expect(licensing).toMatch(/CREATE TABLE "licensing"\."subscriptions"/);
    expect(licensing).toMatch(/tenant_id/);
    expect(licensing).toMatch(/DEFAULT/);
    expect(licensing).toMatch(/plan/);
    expect(licensing).toMatch(/trialing/);
    expect(licensing).toMatch(/active/);
    expect(licensing).toMatch(/past_due/);
    expect(licensing).toMatch(/canceled/);
    expect(licensing).toMatch(/period_start/);
    expect(licensing).toMatch(/period_end/);
    expect(licensing).toMatch(/provider_ref/);

    expect(licensing).toMatch(/add_on_grants/);
    expect(licensing).toMatch(/subscription_id/);
    expect(licensing).toMatch(/add_on_id/);
    expect(licensing).toMatch(/purchased/);
    expect(licensing).toMatch(/complementary/);

    expect(licensing).toMatch(/flag_overrides/);
    expect(licensing).toMatch(/feature_name/);
    expect(licensing).toMatch(/force_on/);
    expect(licensing).toMatch(/force_off/);

    expect(sources).not.toMatch(/pack\.spreadsheetImport|pack\.advancedReports/);
    expect(licensing).not.toMatch(/FeatureName/);
  });

  it("defines software_payments from licensing §7 without Stripe objects or AR FKs", () => {
    const sql = listSqlMigrations().join("\n");
    const payments = tableSql(sql, "licensing", "software_payments");
    const licensing = schemaSql(sql, "licensing");

    expect(payments).toMatch(/amount_cents/);
    expect(payments).toMatch(/currency/);
    expect(licensing).toMatch(/pending/);
    expect(licensing).toMatch(/succeeded/);
    expect(licensing).toMatch(/failed/);
    expect(licensing).toMatch(/refunded/);
    expect(licensing).toMatch(/'subscription'/);
    expect(licensing).toMatch(/'add_on'/);
    expect(licensing).toMatch(/'manual'/);
    expect(payments).toMatch(/occurred_at/);
    expect(licensing).toMatch(/'stripe'/);
    expect(payments).toMatch(/provider_ref/);
    expect(payments).toMatch(/memo/);
    expect(payments).toMatch(/tenant_id/);
    expect(payments).toMatch(/UNIQUE\("provider_ref"\)/);

    expect(payments).not.toMatch(/invoice_id/);
    expect(licensing).not.toMatch(/REFERENCES "accounting"\./);
    expect(licensing).not.toMatch(/stripe_customer|stripe_event|stripe_price/);
  });

  it("defines issue_reports with the locked status path and actor/surface enums", () => {
    const sql = listSqlMigrations().join("\n");
    const reports = tableSql(sql, "operator_bridge", "issue_reports");
    const bridge = schemaSql(sql, "operator_bridge");

    expect(reports).toMatch(/summary/);
    expect(reports).toMatch(/details/);
    expect(reports).toMatch(/actor_type/);
    expect(bridge).toMatch(/'staff'/);
    expect(bridge).toMatch(/'ops'/);
    expect(bridge).toMatch(/'wholesale'/);
    expect(reports).toMatch(/surface/);
    expect(bridge).toMatch(/'internal'/);
    expect(reports).toMatch(/request_id/);
    expect(reports).toMatch(/release_sha/);
    expect(bridge).toMatch(/'new'/);
    expect(bridge).toMatch(/'queued'/);
    expect(bridge).toMatch(/'forwarded'/);
    expect(bridge).toMatch(/'forward_failed'/);
  });

  it("defines operator_outbox envelope with closed kinds and the only Phase 0 JSONB", () => {
    const sql = listSqlMigrations().join("\n");
    const outbox = tableSql(sql, "operator_bridge", "operator_outbox");
    const bridge = schemaSql(sql, "operator_bridge");

    expect(outbox).toMatch(/product_code/);
    expect(outbox).toMatch(/dc-inventory/);
    expect(outbox).toMatch(/installation_id/);
    expect(outbox).toMatch(/tenant_id/);
    expect(outbox).toMatch(/occurred_at/);
    expect(outbox).toMatch(/idempotency_key/);
    expect(bridge).toMatch(/license\.snapshot/);
    expect(bridge).toMatch(/income\.recorded/);
    expect(bridge).toMatch(/issue\.reported/);
    expect(bridge).toMatch(/heartbeat/);
    expect(outbox).toMatch(/jsonb/i);
    expect(outbox).toMatch(/payload/);
    expect(outbox).toMatch(/UNIQUE\("idempotency_key"\)/);

    expect(bridge).not.toMatch(/order\.placed/);
    expect(bridge).not.toMatch(/kafka/i);
    expect(bridge).not.toMatch(/inventory_outbox/);

    const jsonbTables = [
      ...sql.matchAll(/CREATE TABLE "[^"]+"\."([^"]+)" \([\s\S]*?\);/g),
    ].filter((match) => /jsonb/i.test(match[0]));
    expect(jsonbTables.map((match) => match[1])).toEqual(["operator_outbox"]);
  });

  it("uses UUID PKs, BIGINT cents + CHAR(3) currency, timestamptz, and no invented leftovers", () => {
    const sql = listSqlMigrations().join("\n");
    expect(sql).toMatch(/CREATE SCHEMA "licensing"/);
    expect(sql).toMatch(/CREATE SCHEMA "operator_bridge"/);
    expect(sql).toMatch(/uuid/i);
    expect(sql).toMatch(/bigint/i);
    expect(sql).toMatch(/char\(3\)/i);
    expect(sql).toMatch(/timestamptz|timestamp with time zone/i);
    expect(sql).not.toMatch(/\b(float|real|double precision|numeric)\b/i);

    const sources = schemaSources();
    for (const leftover of inventedLeftovers) {
      expect(sources).not.toMatch(new RegExp(`["']${leftover}["']`));
    }
  });

  it("adds one additive Kit migration after the ER-lift and keeps /ready as SELECT 1", () => {
    const journal = JSON.parse(
      readText("apps/api/drizzle/migrations/meta/_journal.json"),
    ) as { dialect: string; entries: { tag: string }[] };
    expect(journal.dialect).toBe("postgresql");
    expect(journal.entries.length).toBeGreaterThanOrEqual(3);
    expect(journal.entries[0]?.tag).toMatch(/catalog_purchasing_inventory/);
    expect(journal.entries[1]?.tag).toMatch(
      /identity_customers_sales_tax_accounting/,
    );
    expect(journal.entries[2]?.tag).toMatch(/licensing.*operator_bridge/);

    const ready = readText("apps/api/src/infrastructure/db.ts");
    expect(ready).toContain("SELECT 1");
    expect(ready).not.toMatch(/migrate/i);

    const vitest = readText("vitest.config.ts");
    expect(vitest).not.toMatch(/docker|compose|db:migrate/i);
  });
});
