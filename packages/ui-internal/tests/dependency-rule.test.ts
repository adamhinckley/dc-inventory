import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return walk(path);
    }
    return /\.(ts|tsx)$/.test(entry) && !entry.endsWith(".stories.tsx")
      ? [path]
      : [];
  });
}

describe("ui-internal isolation", () => {
  it("does not import Next navigation or Orval clients", () => {
    const sources = walk(srcDir);
    expect(sources.length).toBeGreaterThan(0);
    for (const file of sources) {
      const code = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(code, file).not.toMatch(/from\s+["']next\/navigation["']/);
      expect(code, file).not.toMatch(
        /from\s+["']@dc-inventory\/api-client-[^"']+["']/,
      );
    }
  });
});
