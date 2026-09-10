import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

function readText(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

const workflowPath = ".github/workflows/compose-migrate-ready.yml";
const scriptPath = "scripts/ci-compose-migrate-ready.sh";

describe("required CI: Compose + db:migrate + GET /ready (ADA-55)", () => {
  it("declares a non-optional workflow that starts Compose, migrates, and proves /ready", () => {
    expect(existsSync(resolve(root, workflowPath))).toBe(true);
    const workflow = readText(workflowPath);

    expect(workflow).toMatch(/^\s+pull_request:\s*$/m);
    expect(workflow).toMatch(/^\s+push:\s*$/m);
    expect(workflow).toContain("compose-migrate-ready");
    expect(workflow).toContain("ubuntu-latest");
    expect(workflow).toMatch(/docker compose up -d --wait|ci-compose-migrate-ready\.sh/);
    expect(workflow).toMatch(/pnpm db:migrate|ci-compose-migrate-ready\.sh/);
    expect(workflow).toMatch(/pnpm dev:api|ci-compose-migrate-ready\.sh/);
    expect(workflow).toMatch(/\/ready|ci-compose-migrate-ready\.sh/);

    expect(workflow).not.toMatch(/continue-on-error:\s*true/);
    expect(workflow).not.toMatch(/workflow_dispatch:\s*$/m);
    expect(workflow).not.toMatch(/^\s+if:\s+/m);
    expect(workflow).not.toMatch(/paths-ignore:|paths:/);
    expect(workflow).not.toMatch(/secrets\./);
    expect(workflow).not.toMatch(/IFileStorage|aws-sdk|@aws-sdk|minio-js/i);

    expect(workflow).toContain("postgres://postgres:postgres@localhost:5432/dc_inventory");
    expect(workflow).toContain("POSTGRES_PASSWORD: postgres");
    expect(workflow).toContain("MINIO_ROOT_PASSWORD: minio-placeholder");
  });

  it("keeps the local/CI stop condition in a script that fails closed on /ready", () => {
    expect(existsSync(resolve(root, scriptPath))).toBe(true);
    const script = readText(scriptPath);

    expect(script).toContain("docker compose up -d --wait");
    expect(script).toContain("pnpm db:migrate");
    expect(script).toContain("AR_READ_INTEGRATION=1");
    expect(script).toContain("accounting-ar-read.integration.test.ts");
    expect(script).toContain("accounting-payments-received-list-query.integration.test.ts");
    expect(script).toContain("pnpm dev:api");
    expect(script).toMatch(/\/ready/);
    expect(script).toMatch(/ready":true/);
    expect(script).toContain("postgres://postgres:postgres@localhost:5432/dc_inventory");
    expect(script).not.toMatch(/secrets\./);
    expect(script).not.toMatch(/IFileStorage/);
    expect(script).not.toMatch(/\bpnpm test\b/);
    expect(script).not.toMatch(/migrate.*\/ready|\/ready.*migrate/i);
  });

  it("leaves /ready as SELECT 1 and /health free of Postgres", () => {
    const ready = readText("apps/api/src/infrastructure/db.ts");
    expect(ready).toContain("SELECT 1");
    expect(ready).not.toMatch(/migrate/i);

    const health = readText("apps/api/src/adapters/http/health.ts");
    expect(health).toContain('"/health"');
    const healthHandler = health.slice(
      health.indexOf('"/health"'),
      health.indexOf('"/ready"'),
    );
    expect(healthHandler).toContain("async () => ({ ok: true as const })");
    expect(healthHandler).not.toMatch(
      /sql`|createPostgres|DATABASE_URL|migrate|readyCheck/i,
    );
  });

  it("does not put Docker, network, or migrate inside Vitest", () => {
    const vitest = readText("vitest.config.ts");
    expect(vitest).not.toMatch(/docker|compose|db:migrate/i);
    expect(vitest).toContain("tests/**/*.test.ts");
  });
});
