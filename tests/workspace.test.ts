import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

function readText(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("workspace", () => {
  it("declares apps/* and packages/* workspaces", () => {
    const yaml = readText("pnpm-workspace.yaml");
    expect(yaml).toContain("apps/*");
    expect(yaml).toContain("packages/*");
  });

  it("enables TypeScript strict mode", () => {
    const tsconfig = JSON.parse(readText("tsconfig.base.json")) as {
      compilerOptions: { strict: boolean };
    };
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it("exposes the agent scripts", () => {
    const pkg = JSON.parse(readText("package.json")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts).toEqual(
      expect.objectContaining({
        test: expect.any(String),
        lint: expect.any(String),
        "dev:api": expect.any(String),
        "gen:api": expect.any(String),
      }),
    );
  });

  it("requires Node >=22.12.0 to match Vite", () => {
    const pkg = JSON.parse(readText("package.json")) as {
      engines: { node: string };
    };
    expect(pkg.engines.node).toBe(">=22.12.0");
  });
});
