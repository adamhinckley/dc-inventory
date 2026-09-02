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

  it("loads IBM Plex from the same Google Fonts stylesheet Storybook and the app share", () => {
    expect(css).toContain(
      "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap",
    );
  });

  it("locks Carbon White hex on :root under semantic names", () => {
    const root = block(":root");
    expect(root).toContain("--color-surface-base: #ffffff");
    expect(root).toContain("--color-fg: #161616");
    expect(root).toContain("--color-error: #da1e28");
    expect(root).toContain("--color-primary-strong: #0f62fe");
    expect(root).toContain("--color-secondary: #d0e2ff");
    expect(root).toContain("--color-secondary-content: #0043ce");
    expect(root).toContain("--color-chart-08: #000000");
  });

  it("locks Carbon Gray 100 hex on .dark", () => {
    expect(css).toMatch(/\.dark[\s\S]*--color-surface-base: #161616/);
    expect(css).toMatch(/\.dark[\s\S]*--color-fg: #f4f4f4/);
    expect(css).toMatch(/\.dark[\s\S]*--color-error: #fa4d56/);
    expect(css).toMatch(/\.dark[\s\S]*--color-fg-tertiary: #a8a8a8/);
    expect(css).toMatch(/\.dark[\s\S]*--color-secondary: #4589ff/);
    expect(css).toMatch(/\.dark[\s\S]*--color-highlight: #001d6c/);
    expect(css).toMatch(/\.dark[\s\S]*--color-success: #42be65/);
    expect(css).toMatch(/\.dark[\s\S]*--color-chart-08: #f4f4f4/);
  });

  it("does not reintroduce Carbon role names as the public token language", () => {
    expect(css).not.toContain("--color-background-brand:");
    expect(css).not.toContain("--color-text-primary:");
    expect(css).not.toContain("--color-layer-01:");
  });

  it("paints scrollbar troughs with the page panel surface token in both themes", () => {
    const utilities = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../src/tokens/shared.utilities.css",
      ),
      "utf8",
    );
    const utilityMatch = utilities.match(
      /@utility scrollbar-track-raised\s*\{([\s\S]*?)\n\}/,
    );
    expect(utilityMatch?.[1]).toBeDefined();
    const utilityBody = utilityMatch![1];

    const lightRaised = block(":root").match(
      /--color-surface-raised:\s*([^;]+)/,
    )?.[1]?.trim();
    expect(css).toMatch(/\.dark[\s\S]*--color-surface-raised: #262626/);

    expect(lightRaised).toBe("#f4f4f4");

    expect(utilityBody).toContain(
      "scrollbar-color: var(--color-fg-muted) var(--color-surface-raised)",
    );
    expect(utilityBody).toContain(
      "background-color: var(--color-surface-raised)",
    );
    expect(utilityBody).toContain("&::-webkit-scrollbar-corner");

    const cardUtilityMatch = utilities.match(
      /@utility scrollbar-track-card\s*\{([\s\S]*?)\n\}/,
    );
    expect(cardUtilityMatch?.[1]).toContain(
      "scrollbar-color: var(--color-fg-muted) var(--color-surface-card)",
    );
  });

  it("exposes a z-index stack so portaled popups paint above AppShell content", () => {
    const shared = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../src/tokens/shared.css"),
      "utf8",
    );
    expect(shared).toContain("--z-index-content: 1");
    expect(shared).toContain("--z-index-chrome: 20");
    expect(shared).toContain("--z-index-popover: 30");
    expect(shared).toContain("--z-index-drawer: 40");
    expect(shared).toContain("--z-index-toast: 50");
    expect(shared).toContain("--space-input-height: 2.375rem");
    expect(css).toContain("--z-index-popover: var(--z-index-popover)");
    expect(css).toContain("--z-index-drawer: var(--z-index-drawer)");
    expect(css).toContain("--z-index-toast: var(--z-index-toast)");
  });

  it("locks one comfortable control height on Input, Combobox, and Button md", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../src");
    const button = readFileSync(join(root, "ui/Button/Button.tsx"), "utf8");
    const combobox = readFileSync(join(root, "ui/Combobox/Combobox.tsx"), "utf8");
    const input = readFileSync(join(root, "primitives/input.tsx"), "utf8");
    expect(button).toContain("md: 'min-h-(--space-input-height) px-button-x'");
    expect(button).toContain(
      "interactable disableable inline-flex items-center justify-center gap-icon text-button font-bold",
    );
    expect(css).toMatch(/@utility text-button \{[\s\S]*?font-weight: 700/);
    expect(button).toContain(
      "bg-interactive text-fg border border-border-field",
    );
    expect(combobox).toContain("min-h-(--space-input-height)");
    expect(combobox).toContain(
      "size-5 shrink-0 items-center justify-center border-0 bg-transparent p-0",
    );
    expect(input).toContain("min-h-(--space-input-height)");
    const autocomplete = readFileSync(
      join(root, "ui/Autocomplete/Autocomplete.tsx"),
      "utf8",
    );
    expect(autocomplete).toContain("min-h-(--space-input-height)");
    expect(autocomplete).toContain(
      "size-5 shrink-0 items-center justify-center border-0 bg-transparent p-0",
    );
  });
});
