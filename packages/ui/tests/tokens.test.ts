import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/globals.css"),
  "utf8",
);

function block(name: string): string {
  const match = css.match(
    new RegExp(`${name.replace(".", "\\.")}\\s*\\{([\\s\\S]*?)\\n\\}`),
  );
  if (!match?.[1]) {
    throw new Error(`Missing ${name} block in globals.css`);
  }
  return match[1];
}

describe("internal dashboard tokens (Carbon hex, semantic names)", () => {
  it("loads Tailwind v4 and class-based dark", () => {
    expect(css).toContain('@import "tailwindcss"');
    expect(css).toContain("@custom-variant dark");
  });

  it("locks Carbon White hex on :root under semantic names", () => {
    const root = block(":root");
    expect(root).toContain("--color-surface-base: #ffffff");
    expect(root).toContain("--color-fg: #161616");
    expect(root).toContain("--color-error: #da1e28");
    expect(root).toContain("--color-primary-strong: #0f62fe");
    expect(root).toContain("--color-chart-08: #000000");
  });

  it("locks Carbon Gray 100 hex on .dark", () => {
    expect(css).toMatch(/\.dark[\s\S]*--color-surface-base: #161616/);
    expect(css).toMatch(/\.dark[\s\S]*--color-fg: #f4f4f4/);
    expect(css).toMatch(/\.dark[\s\S]*--color-error: #fa4d56/);
    expect(css).toMatch(/\.dark[\s\S]*--color-fg-tertiary: #a8a8a8/);
    expect(css).toMatch(/\.dark[\s\S]*--color-highlight: #001d6c/);
    expect(css).toMatch(/\.dark[\s\S]*--color-success: #42be65/);
    expect(css).toMatch(/\.dark[\s\S]*--color-chart-08: #f4f4f4/);
  });

  it("does not reintroduce Carbon role names as the public token language", () => {
    expect(css).not.toContain("--color-background-brand:");
    expect(css).not.toContain("--color-text-primary:");
    expect(css).not.toContain("--color-layer-01:");
  });
});
