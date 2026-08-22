import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = join(import.meta.dirname, "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") {
        return [];
      }
      return walk(path);
    }
    return /\.(ts|tsx|js|jsx|css|md)$/.test(entry) ? [path] : [];
  });
}

describe("wholesale shop", () => {
  it("does not import DataTable or ui-internal", () => {
    const sources = walk(appRoot).filter(
      (path) => !path.endsWith(".test.ts") && !path.endsWith(".test.tsx"),
    );

    expect(sources.length).toBeGreaterThan(0);

    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/@dc-inventory\/ui-internal/);
      expect(text, file).not.toMatch(/from\s+["'][^"']*DataTable["']/);
      expect(text, file).not.toMatch(/import\s*\{[^}]*\bDataTable\b/);
    }
  });
});
