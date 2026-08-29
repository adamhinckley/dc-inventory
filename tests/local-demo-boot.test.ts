import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

function readText(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("local demo boot (ADA-51)", () => {
  it("Compose file declares Postgres 18 and pinned MinIO with placeholder credentials", () => {
    const compose = readText("docker-compose.yml");
    expect(compose).toMatch(/image:\s*postgres:18\b/);
    expect(compose).toMatch(/postgres18_data:\/var\/lib\/postgresql$/m);
    expect(compose).not.toMatch(/\/var\/lib\/postgresql\/data/);
    expect(compose).toContain(
      "image: quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z",
    );
    expect(compose).not.toMatch(/minio\/minio:latest/);
    expect(compose).toContain("pg_isready");
    expect(compose).toContain("POSTGRES_USER: ${POSTGRES_USER:-postgres}");
    expect(compose).toContain(
      "POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}",
    );
    expect(compose).toContain("POSTGRES_DB: ${POSTGRES_DB:-dc_inventory}");
    expect(compose).toContain("MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minio}");
    expect(compose).toContain(
      "MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minio-placeholder}",
    );
    expect(compose).not.toMatch(/better-auth|stripe/i);
    expect(compose).not.toMatch(/^\s+image:\s*(awscli|localstack)/m);
    expect(compose).toContain("PHASE1_STAFF_PASSWORD");
    expect(compose).toContain("PHASE1_WHOLESALE_PASSWORD");
  });

  it("keeps committed env examples as placeholders only", () => {
    const rootEnv = readText(".env.example");
    expect(rootEnv).toContain("POSTGRES_USER=postgres");
    expect(rootEnv).toContain("POSTGRES_PASSWORD=postgres");
    expect(rootEnv).toContain("MINIO_ROOT_USER=minio");
    expect(rootEnv).toContain("MINIO_ROOT_PASSWORD=minio-placeholder");

    const apiEnv = readText("apps/api/.env.example");
    expect(apiEnv).toMatch(/^DATABASE_TARGET=local$/m);
    expect(apiEnv).toMatch(/^DATABASE_URL_LOCAL=/m);
    expect(apiEnv).toMatch(/^DATABASE_URL_NEON=$/m);
    expect(apiEnv).toMatch(/^DATABASE_URL=/m);
    expect(apiEnv).toMatch(/^PORT=/m);
    expect(apiEnv).toContain(
      "postgres://postgres:postgres@localhost:5432/dc_inventory",
    );
    expect(rootEnv).toContain("PHASE1_STAFF_PASSWORD=phase1-staff-placeholder");
    expect(rootEnv).toContain(
      "PHASE1_WHOLESALE_PASSWORD=phase1-wholesale-placeholder",
    );
    expect(apiEnv).toContain("PHASE1_STAFF_PASSWORD=phase1-staff-placeholder");
    expect(apiEnv).toContain(
      "PHASE1_WHOLESALE_PASSWORD=phase1-wholesale-placeholder",
    );
    expect(apiEnv).toContain("DEMO_SEED=dc-inventory-demo-1");
    expect(apiEnv).toMatch(/^DEMO_SEED_RESET=/m);
    expect(rootEnv).not.toMatch(/scrypt\$/);
    expect(apiEnv).not.toMatch(/scrypt\$/);

    expect(readText("apps/wholesale/.env.example")).toContain(
      "API_PROXY_ORIGIN=http://localhost:3001",
    );
    expect(readText("apps/internal/.env.example")).toContain(
      "API_PROXY_ORIGIN=http://localhost:3001",
    );
  });

  it("root pnpm db:migrate runs Drizzle Kit in the API app only", () => {
    const rootPkg = JSON.parse(readText("package.json")) as {
      scripts: Record<string, string>;
    };
    const apiPkg = JSON.parse(readText("apps/api/package.json")) as {
      scripts: Record<string, string>;
    };
    expect(rootPkg.scripts["db:migrate"]).toBe(
      "pnpm --filter @dc-inventory/api db:migrate",
    );
    expect(rootPkg.scripts["db:seed:phase1"]).toBe(
      "pnpm --filter @dc-inventory/api db:seed:phase1",
    );
    expect(apiPkg.scripts["db:migrate"]).toBe("drizzle-kit migrate");
    expect(apiPkg.scripts["db:seed:phase1"]).toBe("tsx src/seed/cli.ts");
    expect(apiPkg.scripts["db:seed:phase1"]).not.toMatch(/drizzle-kit/);
    expect(existsSync(resolve(root, "packages/db"))).toBe(false);
    expect(existsSync(resolve(root, "packages/persistence"))).toBe(false);
    expect(existsSync(resolve(root, "drizzle.config.ts"))).toBe(false);
    expect(existsSync(resolve(root, "apps/api/drizzle.config.ts"))).toBe(true);

    const journal = JSON.parse(
      readText("apps/api/drizzle/migrations/meta/_journal.json"),
    ) as { dialect: string; entries: unknown[] };
    expect(journal.dialect).toBe("postgresql");
    expect(Array.isArray(journal.entries)).toBe(true);
  });

  it("records demo-only locks that are not invariants §18", () => {
    const doc = readText("docs/demo-assumptions.md");
    expect(doc).toMatch(/invoice on ship/i);
    expect(doc).toMatch(/cart = draft sales order/i);
    expect(doc).toMatch(/block oversell/i);
    expect(doc).toMatch(/MP is shop price/i);
    expect(doc).toMatch(/in-memory tax/i);
    expect(doc).toMatch(/not.*invariants\.md.*§18/i);
    expect(doc).toMatch(/Better Auth/i);
    expect(doc).toMatch(/deferred/i);
    expect(doc).toMatch(/opaque staff and wholesale sessions/i);
    expect(doc).toMatch(/pnpm db:seed:phase1/);
    expect(doc).toMatch(/IFileStorage/);
  });

  it("does not put Docker, network, or migrate inside Vitest", () => {
    const vitest = readText("vitest.config.ts");
    expect(vitest).not.toMatch(/docker|compose|db:migrate|db:seed:phase1/i);
    expect(vitest).toContain("tests/**/*.test.ts");
  });
});
