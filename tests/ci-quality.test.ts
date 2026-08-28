import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

function readText(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

const workflowPath = ".github/workflows/ci-quality.yml";
const scriptPath = "scripts/ci-quality.sh";

describe("required CI: test, lint, gen:api drift (ADA-196)", () => {
  it("declares a non-optional workflow that runs test, lint, and gen:api drift", () => {
    expect(existsSync(resolve(root, workflowPath))).toBe(true);
    const workflow = readText(workflowPath);

    expect(workflow).toMatch(/^\s+pull_request:\s*$/m);
    expect(workflow).toMatch(/^\s+push:\s*$/m);
    expect(workflow).toContain("ci-quality");
    expect(workflow).toContain("ubuntu-latest");
    expect(workflow).toMatch(/ci-quality\.sh/);

    expect(workflow).not.toMatch(/continue-on-error:\s*true/);
    expect(workflow).not.toMatch(/workflow_dispatch:\s*$/m);
    expect(workflow).not.toMatch(/^\s+if:\s+/m);
    expect(workflow).not.toMatch(/paths-ignore:|paths:/);
    expect(workflow).not.toMatch(/\bdocker\b|docker compose|db:migrate/i);
  });

  it("runs pnpm test, lint, gen:api, and fails on committed drift", () => {
    expect(existsSync(resolve(root, scriptPath))).toBe(true);
    const script = readText(scriptPath);

    expect(script).toContain("pnpm test");
    expect(script).toContain("pnpm lint");
    expect(script).toContain("pnpm gen:api");
    expect(script).toContain("git diff --exit-code");
    expect(script).toContain("git status --porcelain");
    expect(script).toContain("openapi/");
    expect(script).toContain("packages/api-client-internal/src/generated/");
    expect(script).toContain("packages/api-client-wholesale/src/generated/");
    expect(script).toContain("packages/api-client-ops/src/generated/");
    expect(script).not.toMatch(/\bdocker\b|\bdocker compose\b|\bpnpm db:migrate\b/);
  });

  it("covers x-table table metadata via openapi drift (gen:api exports x-table)", () => {
    const internalOpenApi = readText("openapi/internal.yaml");
    expect(internalOpenApi).toContain("x-table:");
    const script = readText(scriptPath);
    expect(script).toContain("openapi/");
  });

  it("keeps dependency-direction guards in Vitest (run via pnpm test)", () => {
    const identity = readText("packages/identity/tests/login-and-session.test.ts");
    const catalog = readText("packages/catalog/tests/catalog.test.ts");
    const customers = readText("packages/customers/tests/customers.test.ts");
    const uiInternal = readText("packages/ui-internal/tests/dependency-rule.test.ts");

    expect(identity).toContain("keeps domain/");
    expect(catalog).toMatch(/forbidden|domain/);
    expect(customers).toMatch(/forbidden|domain/);
    expect(uiInternal).toContain("does not import Next navigation or Orval clients");
  });
});
