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

describe("dashboard tokens (work-dashboard-design-spec.md §6)", () => {
  it("loads Tailwind v4 and class-based dark", () => {
    expect(css).toContain('@import "tailwindcss"');
    expect(css).toContain("@custom-variant dark (&:where(.dark, .dark *))");
  });

  it("locks Carbon White on :root", () => {
    const root = block(":root");
    expect(root).toContain("--color-background: #ffffff");
    expect(root).toContain("--color-text-primary: #161616");
    expect(root).toContain("--color-text-error: #da1e28");
    expect(root).toContain("--color-background-brand: #0f62fe");
    expect(root).toContain("--color-chart-08: #000000");
  });

  it("locks Carbon Gray 100 on .dark", () => {
    const dark = block(".dark");
    expect(dark).toContain("--color-background: #161616");
    expect(dark).toContain("--color-text-primary: #f4f4f4");
    expect(dark).toContain("--color-text-error: #ff8389");
    expect(dark).toContain("--color-text-helper: #a8a8a8");
    expect(dark).toContain("--color-highlight: #001d6c");
    expect(dark).toContain("--color-status-ok: #42be65");
    expect(dark).toContain("--color-chart-08: #f4f4f4");
  });
});
