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
    return /\.(ts|tsx|js|jsx)$/.test(entry) ? [path] : [];
  });
}

describe("wholesale shop HTTP", () => {
  it("uses the Orval wholesale client and does not hand-write fetch", () => {
    const sources = walk(appRoot).filter(
      (path) => !path.endsWith(".test.ts") && !path.endsWith(".test.tsx"),
    );

    expect(sources.length).toBeGreaterThan(0);

    const joined = sources.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(joined).toMatch(/@dc-inventory\/api-client-wholesale/);
    expect(joined).toMatch(/useListWholesaleCatalog/);
    expect(joined).toMatch(/useCreateWholesaleSalesOrder/);
    expect(joined).toMatch(/useReplaceWholesaleSalesOrderLines/);
    expect(joined).toMatch(/useApplyWholesaleSalesOrderLineDeltas/);
    expect(joined).toMatch(/useListWholesaleSalesOrders/);
    expect(joined).toMatch(/useGetWholesaleAccountDetail/);
    expect(joined).toMatch(/useListWholesaleShipTos/);
    expect(joined).toMatch(/useConfirmWholesaleSalesOrder/);
    expect(joined).toMatch(/useLoginWholesale/);
    expect(joined).not.toMatch(/@dc-inventory\/api-client-internal/);
    expect(joined).not.toMatch(/@dc-inventory\/api-client-ops/);
    expect(joined).not.toMatch(/preventDefault\(\);\s*\n\s*\}/);

    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/\bfetch\s*\(/);
    }
  });
});
