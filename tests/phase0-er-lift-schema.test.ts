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
    "packages/identity/src/persistence/schema.ts",
    "apps/api/src/infrastructure/schema/identity.ts",
    "packages/customers/src/persistence/schema.ts",
    "apps/api/src/infrastructure/schema/customers.ts",
    "packages/sales/src/persistence/schema.ts",
    "packages/accounting/src/persistence/schema.ts",
    "apps/api/src/infrastructure/schema/tax.ts",
  ];
  return files
    .filter((path) => existsSync(resolve(root, path)))
    .map((path) => readText(path))
    .join("\n");
}

const inventedLeftovers = [
  "password",
  "better_auth",
  "role",
  "rbac",
  "ship_to_id",
  "due_date",
  "stripe_customer",
  "stripe_payment",
  "pan",
  "card_number",
];

describe("Phase 0 identity / customers / sales / tax / accounting schemas (ADA-53)", () => {
  it("registers ER-lift tables in the API Kit schema barrel", () => {
    const barrel = readText("apps/api/src/infrastructure/schema.ts");
    expect(barrel).toMatch(/opsUsers|ops_users/);
    expect(barrel).toMatch(/staffUsers|staff_users/);
    expect(barrel).toMatch(/wholesaleUsers|wholesale_users/);
    expect(barrel).toMatch(/sessions/);
    expect(barrel).toMatch(/customers/);
    expect(barrel).toMatch(/contacts/);
    expect(barrel).toMatch(/shipTos|ship_tos/);
    expect(barrel).toMatch(/exemptionCertificates|exemption_certificates/);
    expect(barrel).toMatch(/orders/);
    expect(barrel).toMatch(/orderLines|order_lines/);
    expect(barrel).toMatch(/taxCommits|tax_commits/);
    expect(barrel).toMatch(/taxCommitLines|tax_commit_lines/);
    expect(barrel).toMatch(/invoices/);
    expect(barrel).toMatch(/invoiceTaxLines|invoice_tax_lines/);
    expect(barrel).toMatch(/payments/);
    expect(barrel).toMatch(/paymentApplications|payment_applications/);
    expect(existsSync(resolve(root, "packages/db"))).toBe(false);
  });

  it("defines identity users and opaque sessions without Better Auth or RBAC", () => {
    const sources = schemaSources();
    const sql = listSqlMigrations().join("\n");

    expect(sources).toMatch(/ops_users/);
    expect(sources).toMatch(/operator/);
    expect(sources).toMatch(/business_owner/);
    expect(sources).toMatch(/tenant_id/);
    expect(sources).toMatch(/DEFAULT/);
    expect(sources).toMatch(/staff_users/);
    expect(sources).toMatch(/wholesale_users/);
    expect(sources).toMatch(/customer_id/);
    expect(sources).toMatch(/actor_type/);
    expect(sql).toMatch(/staff/);
    expect(sql).toMatch(/wholesale/);
    expect(sql).toMatch(/ops/);

    expect(sources).toMatch(/password_hash/);
    expect(sources).not.toMatch(/betterAuth|better_auth/);
    expect(sources).not.toMatch(/["']role["']/);
    expect(sources).not.toMatch(/["']rbac["']/);
    expect(sql).not.toMatch(/better_auth/);
  });

  it("lifts customers, thin contacts, typed ship-tos, and exemption certificates", () => {
    const sources = schemaSources();
    const sql = listSqlMigrations().join("\n");

    expect(sources).toMatch(/credit_limit_cents/);
    expect(sources).toMatch(/terms/);
    expect(sql).toMatch(/"terms" text/);
    expect(sql).not.toMatch(/CREATE TYPE .*"terms"/i);

    expect(sql).toMatch(/contacts/);
    expect(sql).toMatch(/ship_tos/);
    expect(sql).toMatch(/line_1/);
    expect(sql).toMatch(/line_2/);
    expect(sql).toMatch(/is_default/);
    expect(sql).toMatch(/exemption_certificates/);
    expect(sql).toMatch(/object_key/);
    expect(sql).toMatch(/jurisdiction/);
    expect(sql).toMatch(/entity_use_code/);
    expect(sql).toMatch(/expires_at/);

    expect(sources).not.toMatch(/account_number/);
    expect(sources).not.toMatch(/ar_balance/);
    const contactsBlock = sql.match(
      /CREATE TABLE "customers"\."contacts" \([\s\S]*?\);/,
    )?.[0];
    expect(contactsBlock).toBeDefined();
    expect(contactsBlock).not.toMatch(/email|name|phone/);
  });

  it("defines sales orders as carts-in-draft with typed ship snapshots and frozen lines", () => {
    const sql = readText(
      "apps/api/drizzle/migrations/0001_identity_customers_sales_tax_accounting.sql",
    );

    expect(sql).toMatch(/CREATE TABLE "sales"\."orders"/);
    expect(sql).toMatch(/draft/);
    expect(sql).toMatch(/confirmed/);
    expect(sql).toMatch(/shipped/);
    expect(sql).toMatch(/cancelled/);
    expect(sql).toMatch(/ship_line_1/);
    expect(sql).toMatch(/ship_city/);
    expect(sql).toMatch(/ship_region/);
    expect(sql).toMatch(/ship_postal/);
    expect(sql).toMatch(/ship_country/);
    expect(sql).toMatch(/order_lines/);
    expect(sql).toMatch(/unit_price_cents/);
    expect(sql).toMatch(/tax_category_code/);
    expect(sql).not.toMatch(/CREATE TABLE "sales"\."carts"/);
    expect(sql).not.toMatch(/document_number/);
    expect(sql).not.toMatch(/ship_to_id/);
    const salesTables = [
      ...sql.matchAll(/CREATE TABLE "sales"\."[^"]+" \([\s\S]*?\);/g),
    ]
      .map((match) => match[0])
      .join("\n");
    expect(salesTables).not.toMatch(/jsonb/i);
  });

  it("defines tax commits plus frozen invoice tax lines with no live tax FK", () => {
    const sql = listSqlMigrations().join("\n");

    expect(sql).toMatch(/tax_commits/);
    expect(sql).toMatch(/quoted/);
    expect(sql).toMatch(/committed/);
    expect(sql).toMatch(/voided/);
    expect(sql).toMatch(/engine_transaction_id/);
    expect(sql).toMatch(/tax_commit_lines/);
    expect(sql).toMatch(/rate_bps/);
    expect(sql).toMatch(/taxable_base_cents/);
    expect(sql).toMatch(/invoice_tax_lines/);

    const invoiceTaxSql = [
      sql.match(/CREATE TABLE "accounting"\."invoice_tax_lines" \([\s\S]*?\);/)?.[0],
      ...sql.match(
        /ALTER TABLE "accounting"\."invoice_tax_lines"[\s\S]*?;/g,
      ) ?? [],
    ].join("\n");
    expect(invoiceTaxSql).toMatch(/invoice_tax_lines/);
    expect(invoiceTaxSql).not.toMatch(/REFERENCES "tax"\./);
  });

  it("defines accounting invoices, payments, and partial applications without Stripe or PAN", () => {
    const sql = listSqlMigrations().join("\n");

    expect(sql).toMatch(/CREATE TABLE "accounting"\."invoices"/);
    expect(sql).toMatch(/unposted/);
    expect(sql).toMatch(/posted/);
    expect(sql).toMatch(/posted_at/);
    expect(sql).toMatch(/subtotal_cents/);
    expect(sql).toMatch(/tax_total_cents/);
    expect(sql).toMatch(/total_cents/);
    expect(sql).toMatch(/payments/);
    expect(sql).toMatch(/payment_applications/);
    expect(sql).not.toMatch(/due_date/);
    const accountingTables = [
      ...sql.matchAll(/CREATE TABLE "accounting"\."[^"]+" \([\s\S]*?\);/g),
    ]
      .map((match) => match[0])
      .join("\n");
    expect(accountingTables).not.toMatch(/stripe/i);
    expect(accountingTables).not.toMatch(/"pan"/);
    expect(accountingTables).not.toMatch(/software_payments/);
  });

  it("uses UUID PKs, integer qty, BIGINT cents + CHAR(3) currency, timestamptz", () => {
    const sql = listSqlMigrations().join("\n");
    expect(sql).toMatch(/"identity"/);
    expect(sql).toMatch(/"customers"/);
    expect(sql).toMatch(/"sales"/);
    expect(sql).toMatch(/"tax"/);
    expect(sql).toMatch(/"accounting"/);
    expect(sql).toMatch(/uuid/i);
    expect(sql).toMatch(/integer/i);
    expect(sql).toMatch(/bigint/i);
    expect(sql).toMatch(/char\(3\)/i);
    expect(sql).toMatch(/timestamptz|timestamp with time zone/i);
    expect(sql).not.toMatch(/\b(float|real|double precision|numeric)\b/i);

    const sources = schemaSources();
    for (const leftover of inventedLeftovers) {
      expect(sources).not.toMatch(new RegExp(`["']${leftover}["']`));
    }
  });

  it("adds one additive Kit migration after catalog/purchasing/inventory and keeps /ready as SELECT 1", () => {
    const journal = JSON.parse(
      readText("apps/api/drizzle/migrations/meta/_journal.json"),
    ) as { dialect: string; entries: { tag: string }[] };
    expect(journal.dialect).toBe("postgresql");
    expect(journal.entries.length).toBeGreaterThanOrEqual(2);
    expect(journal.entries[0]?.tag).toMatch(/catalog_purchasing_inventory/);

    const sql = listSqlMigrations().join("\n");
    expect(sql).toMatch(/CREATE SCHEMA "identity"/);
    expect(sql).toMatch(/CREATE SCHEMA "customers"/);
    expect(sql).toMatch(/CREATE SCHEMA "sales"/);
    expect(sql).toMatch(/CREATE SCHEMA "tax"/);
    expect(sql).toMatch(/CREATE SCHEMA "accounting"/);

    const ready = readText("apps/api/src/infrastructure/db.ts");
    expect(ready).toContain("SELECT 1");
    expect(ready).not.toMatch(/migrate/i);

    const vitest = readText("vitest.config.ts");
    expect(vitest).not.toMatch(/docker|compose|db:migrate/i);
  });
});
