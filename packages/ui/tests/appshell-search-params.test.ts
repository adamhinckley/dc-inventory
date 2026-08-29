import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../src/shells/AppShell/AppShell.tsx",
  ),
  "utf8",
);

describe("AppShell search params", () => {
  it("only calls useSearchParams in query-carrying helpers behind Suspense", () => {
    expect(source).toContain("function NavItemWithSearchParams");
    expect(source).toContain("function CollapsedNavGroupMenuWithSearch");
    expect(source).toMatch(
      /<Suspense fallback=\{null\}>\s*<NavItemWithSearchParams/,
    );
    expect(source).toMatch(
      /<Suspense fallback=\{null\}>\s*<CollapsedNavGroupMenuWithSearch/,
    );

    const calls = [...source.matchAll(/useSearchParams\(/g)];
    expect(calls).toHaveLength(2);

    const navGroupFn = source.slice(source.indexOf("export function NavGroup"));
    const navGroupBody = navGroupFn.slice(
      0,
      navGroupFn.indexOf("type CollapsedNavGroupMenuProps"),
    );
    expect(navGroupBody).not.toMatch(/useSearchParams\(/);

    const navItemFn = source.slice(source.indexOf("export function NavItem"));
    const navItemBody = navItemFn.slice(
      0,
      navItemFn.indexOf("function NavItemWithSearchParams"),
    );
    expect(navItemBody).not.toMatch(/useSearchParams\(/);
  });

  it("stops the page scroller when a sticky table is present", () => {
    expect(source).toMatch(
      /has-data-sticky-table:flex has-data-sticky-table:min-h-0 has-data-sticky-table:flex-col has-data-sticky-table:overflow-hidden/,
    );
  });
});
